import 'reflect-metadata';
import { randomUUID } from 'crypto';
import appDataSource from '../src/database/data-source';

type BackfillUser = {
  id: string;
  email: string;
  name?: string | null;
  activeWorkspaceId?: string | null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `workspace-${Date.now()}`;

const toWorkspaceName = (user: BackfillUser): string =>
  (user.name && `${user.name}'s Workspace`) ||
  (user.email ? `${user.email.split('@')[0]}'s Workspace` : 'My Workspace');

const resolveUniqueSlug = async (
  query: (sql: string, parameters?: unknown[]) => Promise<unknown[]>,
  baseName: string,
): Promise<string> => {
  const rootSlug = slugify(baseName);
  let attempt = 0;
  while (attempt < 500) {
    const candidateSlug = attempt === 0 ? rootSlug : `${rootSlug}-${attempt}`;
    const existingWorkspace = await query(
      `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
      [candidateSlug],
    );
    if (!existingWorkspace.length) return candidateSlug;
    attempt += 1;
  }
  throw new Error(`Unable to resolve unique workspace slug for '${baseName}'`);
};

const run = async () => {
  const queryRunner = appDataSource.createQueryRunner();
  const dryRun = process.argv.includes('--dry-run');
  const typedQuery = async (
    sql: string,
    parameters?: unknown[],
  ): Promise<unknown[]> => {
    // queryRunner.query returns untyped rows; cast to controlled unknown[] boundary.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await queryRunner.query(sql, parameters);
    return result as unknown[];
  };

  await appDataSource.initialize();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();

    const users = (await queryRunner.query(
      `SELECT id, email, name, "activeWorkspaceId" FROM users ORDER BY "createdAt" ASC`,
    )) as BackfillUser[];

    const summary = {
      usersScanned: users.length,
      workspacesCreated: 0,
      membershipsCreated: 0,
      usersActivated: 0,
      providersUpdated: 0,
      mailboxesUpdated: 0,
    };

    for (const user of users) {
      const existingPersonalWorkspace = (await queryRunner.query(
        `SELECT id FROM workspaces WHERE "ownerUserId" = $1 AND "isPersonal" = true ORDER BY "createdAt" ASC LIMIT 1`,
        [user.id],
      )) as Array<{ id: string }>;

      let workspaceId = existingPersonalWorkspace[0]?.id;
      if (!workspaceId) {
        const workspaceName = toWorkspaceName(user);
        const workspaceSlug = await resolveUniqueSlug(
          typedQuery,
          workspaceName,
        );
        workspaceId = randomUUID();
        summary.workspacesCreated += 1;

        if (!dryRun) {
          await queryRunner.query(
            `INSERT INTO workspaces (id, "ownerUserId", name, slug, "isPersonal", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [workspaceId, user.id, workspaceName, workspaceSlug],
          );
        }
      }

      const normalizedEmail = String(user.email || `${user.id}@local.user`)
        .trim()
        .toLowerCase();
      const existingMembership = (await queryRunner.query(
        `SELECT id FROM workspace_members WHERE "workspaceId" = $1 AND email = $2 LIMIT 1`,
        [workspaceId, normalizedEmail],
      )) as Array<{ id: string }>;

      if (!existingMembership.length) {
        summary.membershipsCreated += 1;
        if (!dryRun) {
          await queryRunner.query(
            `INSERT INTO workspace_members (
              id, "workspaceId", "userId", email, role, status, "invitedByUserId", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, 'OWNER', 'active', $5, NOW(), NOW())`,
            [randomUUID(), workspaceId, user.id, normalizedEmail, user.id],
          );
        }
      }

      if (!user.activeWorkspaceId) {
        summary.usersActivated += 1;
        if (!dryRun) {
          await queryRunner.query(
            `UPDATE users SET "activeWorkspaceId" = $1 WHERE id = $2`,
            [workspaceId, user.id],
          );
        }
      }

      const providerUpdateResult = (await queryRunner.query(
        `SELECT id FROM email_providers WHERE "userId" = $1 AND "workspaceId" IS NULL`,
        [user.id],
      )) as Array<{ id: string }>;
      if (providerUpdateResult.length) {
        summary.providersUpdated += providerUpdateResult.length;
        if (!dryRun) {
          await queryRunner.query(
            `UPDATE email_providers SET "workspaceId" = $1 WHERE "userId" = $2 AND "workspaceId" IS NULL`,
            [workspaceId, user.id],
          );
        }
      }

      const mailboxUpdateResult = (await queryRunner.query(
        `SELECT id FROM mailboxes WHERE "userId" = $1 AND "workspaceId" IS NULL`,
        [user.id],
      )) as Array<{ id: string }>;
      if (mailboxUpdateResult.length) {
        summary.mailboxesUpdated += mailboxUpdateResult.length;
        if (!dryRun) {
          await queryRunner.query(
            `UPDATE mailboxes SET "workspaceId" = $1 WHERE "userId" = $2 AND "workspaceId" IS NULL`,
            [workspaceId, user.id],
          );
        }
      }
    }

    if (dryRun) {
      await queryRunner.rollbackTransaction();
      console.log(
        `Workspace backfill dry-run summary: ${JSON.stringify(summary)}`,
      );
      return;
    }

    await queryRunner.commitTransaction();
    console.log(`Workspace backfill summary: ${JSON.stringify(summary)}`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Workspace backfill failed: ${message}`);
    throw error;
  } finally {
    await queryRunner.release();
    await appDataSource.destroy();
  }
};

void run();
