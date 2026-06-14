/**
 * Demo seed script — creates a test user + realistic sample data for local testing.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo.ts
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo.ts --fresh
 *
 * `--fresh` removes all rows tied to the demo account (see DEMO_* constants below),
 * then re-seeds so inbox content is deterministic.
 *
 * Credentials created:
 *   Email:    demo@mailzen.dev
 *   Password: Demo@1234
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql:///mailzen?host=/var/run/postgresql';

const DEMO_USER_ID = '10000000-0000-0000-0000-000000000001';
const DEMO_WORKSPACE_ID = '20000000-0000-0000-0000-000000000001';
const DEMO_PROVIDER_ID = '30000000-0000-0000-0000-000000000001';
const DEMO_SUBSCRIPTION_ID = '50000000-0000-0000-0000-000000000001';
const DEMO_SMART_REPLY_SETTINGS_ID =
  '50000000-0000-0000-0000-000000000002';
const DEMO_NOTIFICATION_PREFS_ID = '50000000-0000-0000-0000-000000000003';

const FRESH = process.argv.includes('--fresh');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function bodyFromSnippet(subject: string, snippet: string): string {
  return `${subject}\n\n${snippet}\n\n—\nThis is demo message body text for MailZen local development.`;
}

// DELETE wrapper that ignores "relation does not exist" errors. Some demo
// tables (external_email_messages, audit_logs, user_notifications, etc.)
// were removed when entities were consolidated — wipe is a no-op for them.
// Uses a savepoint so a missing table does not abort the outer transaction.
async function safeDelete(
  client: Client,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await client.query(`SAVEPOINT ${sp}`);
    await client.query(sql, params);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
  } catch (err: any) {
    if (err && err.code === '42P01') {
      // Table missing — roll back just this savepoint and continue
      await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      return;
    }
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    throw err;
  }
}

async function wipeDemoAccount(client: Client, demoEmail: string) {
  console.log('🧹  Removing existing demo account data (--fresh)…');
  await client.query('BEGIN');
  try {
    await safeDelete(client,`DELETE FROM external_email_messages WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM smart_reply_history WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM agent_action_audits WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM audit_logs WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM user_ai_credit_usages WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM billing_invoices WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM mailbox_inbound_events WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM mailbox_sync_runs WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM notification_push_subscriptions WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM user_notifications WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(
      client,
      `DELETE FROM email_analytics WHERE "emailId" IN (
        SELECT id FROM emails WHERE "userId" = $1
      )`,
      [DEMO_USER_ID],
    );
    await safeDelete(
      client,
      `DELETE FROM email_label_assignments WHERE "emailId" IN (
        SELECT id FROM emails WHERE "userId" = $1
      )`,
      [DEMO_USER_ID],
    );
    await client.query(
      `DELETE FROM attachments WHERE "emailId" IN (
        SELECT id FROM emails WHERE "userId" = $1
      )`,
      [DEMO_USER_ID],
    );
    await client.query(`DELETE FROM emails WHERE "userId" = $1`, [DEMO_USER_ID]);
    await client.query(`DELETE FROM contacts WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM labels WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM external_email_labels WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await client.query(
      `DELETE FROM workspace_members WHERE "workspaceId" = $1 OR "userId" = $2`,
      [DEMO_WORKSPACE_ID, DEMO_USER_ID],
    );
    await safeDelete(client,`DELETE FROM user_subscriptions WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM user_notification_preferences WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM smart_reply_settings WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM user_sessions WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM verification_tokens WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await client.query(
      `DELETE FROM warmup_activities WHERE "warmupId" IN (
        SELECT id FROM email_warmups WHERE "providerId" = $1
      )`,
      [DEMO_PROVIDER_ID],
    );
    await client.query(`DELETE FROM email_warmups WHERE "providerId" = $1`, [
      DEMO_PROVIDER_ID,
    ]);
    await client.query(`DELETE FROM mailboxes WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await client.query(`DELETE FROM email_filters WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM email_folders WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await safeDelete(client,`DELETE FROM templates WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await client.query(`DELETE FROM phone_verifications WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await client.query(`DELETE FROM email_providers WHERE "userId" = $1`, [
      DEMO_USER_ID,
    ]);
    await client.query(`DELETE FROM workspaces WHERE id = $1`, [
      DEMO_WORKSPACE_ID,
    ]);
    await client.query(`DELETE FROM users WHERE id = $1 OR email = $2`, [
      DEMO_USER_ID,
      demoEmail,
    ]);
    await client.query('COMMIT');
    console.log('🧹  Demo wipe complete.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('🌱  Connected to database');

  const demoEmail = 'demo@mailzen.dev';

  try {
    if (FRESH) {
      await wipeDemoAccount(client, demoEmail);
    }
    // -----------------------------------------------------------------------
    // 1. Billing plans
    // -----------------------------------------------------------------------
    console.log('📋  Seeding billing plans…');
    await client.query(`
      INSERT INTO plans (id, code, name, "priceMonthlyCents", currency,
        "providerLimit", "mailboxLimit", "workspaceLimit", "workspaceMemberLimit",
        "aiCreditsPerMonth", "mailboxStorageLimitMb", "isActive")
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'free',     'Free',     0,    'USD', 1, 1, 1, 1,   50,  512,  true),
        ('00000000-0000-0000-0000-000000000002', 'pro',      'Pro',      1900, 'USD', 5, 5, 3, 10,  500, 5120, true),
        ('00000000-0000-0000-0000-000000000003', 'business', 'Business', 4900, 'USD', 20,20,10,50, 2000,20480, true)
      ON CONFLICT (code) DO NOTHING
    `);

    // -----------------------------------------------------------------------
    // 2. Demo user
    // -----------------------------------------------------------------------
    console.log('👤  Seeding demo user…');
    const demoPassword = 'Demo@1234';
    const passwordHash = await bcrypt.hash(demoPassword, 12);
    const userId = DEMO_USER_ID;
    const workspaceId = DEMO_WORKSPACE_ID;
    const providerId = DEMO_PROVIDER_ID;

    await client.query(`
      INSERT INTO users
        (id, email, password, name, role, "isEmailVerified", "activeWorkspaceId")
      VALUES
        ($1, $2, $3, 'Demo User', 'USER', true, $4)
      ON CONFLICT (email) DO UPDATE
        SET password = EXCLUDED.password,
            name = EXCLUDED.name,
            "isEmailVerified" = true,
            "activeWorkspaceId" = EXCLUDED."activeWorkspaceId"
    `, [userId, demoEmail, passwordHash, workspaceId]);

    // -----------------------------------------------------------------------
    // 3. Workspace
    // -----------------------------------------------------------------------
    console.log('🏢  Seeding workspace…');
    await client.query(`
      INSERT INTO workspaces (id, name, slug, "ownerUserId", "isPersonal")
      VALUES ($1, 'Demo Workspace', 'demo-workspace', $2, true)
      ON CONFLICT (id) DO NOTHING
    `, [workspaceId, userId]);

    // Add user as workspace owner member
    await client.query(`
      INSERT INTO workspace_members (id, "workspaceId", "userId", email, role, status, "invitedByUserId")
      VALUES ($1, $2, $3, $4, 'OWNER', 'active', $3)
      ON CONFLICT ("workspaceId", email) DO NOTHING
    `, [randomUUID(), workspaceId, userId, demoEmail]);

    // -----------------------------------------------------------------------
    // 4. User subscription (free plan)
    // -----------------------------------------------------------------------
    console.log('💳  Seeding subscription…');
    await client.query(`
      INSERT INTO user_subscriptions
        (id, "userId", "planCode", status, "startedAt", "isTrial")
      VALUES
        ($1, $2, 'free', 'active', NOW(), false)
      ON CONFLICT (id) DO UPDATE SET
        "planCode" = EXCLUDED."planCode",
        status = EXCLUDED.status,
        "startedAt" = EXCLUDED."startedAt",
        "isTrial" = EXCLUDED."isTrial"
    `, [DEMO_SUBSCRIPTION_ID, userId]);

    // -----------------------------------------------------------------------
    // 5. Smart reply settings
    // -----------------------------------------------------------------------
    console.log('🤖  Seeding smart reply settings…');
    await client.query(`
      INSERT INTO smart_reply_settings
        (id, "userId", enabled, "defaultTone", "defaultLength", "aiModel",
         "includeSignature", personalization, "creativityLevel", "maxSuggestions",
         "keepHistory", "historyLength")
      VALUES
        ($1, $2, true, 'professional', 'medium', 'auto', true, 5, 5, 3, true, 20)
      ON CONFLICT ("userId") DO UPDATE SET
        enabled = EXCLUDED.enabled,
        "defaultTone" = EXCLUDED."defaultTone",
        "defaultLength" = EXCLUDED."defaultLength",
        "aiModel" = EXCLUDED."aiModel",
        "includeSignature" = EXCLUDED."includeSignature",
        personalization = EXCLUDED.personalization,
        "creativityLevel" = EXCLUDED."creativityLevel",
        "maxSuggestions" = EXCLUDED."maxSuggestions",
        "keepHistory" = EXCLUDED."keepHistory",
        "historyLength" = EXCLUDED."historyLength"
    `, [DEMO_SMART_REPLY_SETTINGS_ID, userId]);

    // -----------------------------------------------------------------------
    // 6. Demo email provider (SMTP/demo — no real credentials needed)
    // -----------------------------------------------------------------------
    console.log('📧  Seeding demo email provider…');
    await client.query(`
      INSERT INTO email_providers
        (id, type, email, "displayName", "isActive", status, "userId")
      VALUES
        ($1, 'SMTP', $2, 'Demo Inbox', true, 'connected', $3)
      ON CONFLICT (id) DO NOTHING
    `, [providerId, demoEmail, userId]);

    // Update user's active inbox to this provider
    await client.query(`
      UPDATE users
      SET "activeInboxType" = 'PROVIDER', "activeInboxId" = $1
      WHERE id = $2
    `, [providerId, userId]);

    // -----------------------------------------------------------------------
    // 7. Email labels
    // -----------------------------------------------------------------------
    console.log('🏷️   Seeding email labels…');
    const labels = [
      { id: '40000000-0000-0000-0000-000000000001', name: 'Important',  color: '#ef4444' },
      { id: '40000000-0000-0000-0000-000000000002', name: 'Work',       color: '#3b82f6' },
      { id: '40000000-0000-0000-0000-000000000003', name: 'Newsletter', color: '#10b981' },
      { id: '40000000-0000-0000-0000-000000000004', name: 'Follow-up',  color: '#f59e0b' },
    ];
    for (const lbl of labels) {
      await client.query(`
        INSERT INTO labels (id, name, color, "userId")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [lbl.id, lbl.name, lbl.color, userId]);
    }

    // -----------------------------------------------------------------------
    // 8. Demo email threads (external_email_messages)
    // -----------------------------------------------------------------------
    console.log('✉️   Seeding demo email threads…');

    const threads: Array<{
      id: string;
      threadId: string;
      from: string;
      to: string[];
      subject: string;
      snippet: string;
      labels: string[];
      daysAgoN: number;
    }> = [
      {
        id: '60000000-0000-0000-0000-000000000001',
        threadId: 'thread-001',
        from: 'Sarah Connor <sarah@acme.com>',
        to: [demoEmail],
        subject: 'Q1 Sales Report — Action Required',
        snippet: 'Hi, please review the attached Q1 sales report and approve the budget allocation before Friday. The board needs final numbers by EOD.',
        labels: ['INBOX', 'UNREAD'],
        daysAgoN: 0,
      },
      {
        id: '60000000-0000-0000-0000-000000000002',
        threadId: 'thread-002',
        from: 'GitHub <noreply@github.com>',
        to: [demoEmail],
        subject: '[MailZen] Pull request #42 merged',
        snippet: 'Your pull request "feat: add unified inbox search" has been merged into main by octocat.',
        labels: ['INBOX'],
        daysAgoN: 1,
      },
      {
        id: '60000000-0000-0000-0000-000000000003',
        threadId: 'thread-003',
        from: 'Stripe <notifications@stripe.com>',
        to: [demoEmail],
        subject: 'Your invoice is ready — $49.00',
        snippet: 'Your invoice for May 2026 is ready. The amount due is $49.00 USD and will be charged on June 1st.',
        labels: ['INBOX', 'UNREAD'],
        daysAgoN: 1,
      },
      {
        id: '60000000-0000-0000-0000-000000000004',
        threadId: 'thread-004',
        from: 'John Doe <john@startup.io>',
        to: [demoEmail],
        subject: 'Partnership Opportunity — Let\'s Connect',
        snippet: 'I came across MailZen and I\'m really impressed with the AI-powered smart replies. We\'d love to explore a potential partnership.',
        labels: ['INBOX', 'UNREAD'],
        daysAgoN: 2,
      },
      {
        id: '60000000-0000-0000-0000-000000000005',
        threadId: 'thread-005',
        from: 'Vercel <vercel@vercel.com>',
        to: [demoEmail],
        subject: 'Deployment successful: mailzen-app',
        snippet: 'Your deployment to production is ready. Visit your site at https://mailzen-app.vercel.app',
        labels: ['INBOX'],
        daysAgoN: 2,
      },
      {
        id: '60000000-0000-0000-0000-000000000006',
        threadId: 'thread-006',
        from: 'Demo User <demo@mailzen.dev>',
        to: ['sarah@acme.com'],
        subject: 'Re: Q4 Planning Meeting',
        snippet: 'Thanks for the invite! I\'ll be there. Should I prepare a deck on the email marketing metrics?',
        labels: ['SENT'],
        daysAgoN: 3,
      },
      {
        id: '60000000-0000-0000-0000-000000000007',
        threadId: 'thread-007',
        from: 'AWS <billing@aws.amazon.com>',
        to: [demoEmail],
        subject: 'Your AWS Bill for April 2026',
        snippet: 'Your AWS account was charged $127.43 for April 2026. View detailed breakdown and cost explorer.',
        labels: ['INBOX'],
        daysAgoN: 5,
      },
      {
        id: '60000000-0000-0000-0000-000000000008',
        threadId: 'thread-008',
        from: 'Product Hunt <hello@producthunt.com>',
        to: [demoEmail],
        subject: 'MailZen is trending on Product Hunt 🚀',
        snippet: 'Congratulations! MailZen is trending in the Productivity category. You\'ve received 142 upvotes so far.',
        labels: ['INBOX', 'UNREAD', 'STARRED'],
        daysAgoN: 5,
      },
      {
        id: '60000000-0000-0000-0000-000000000009',
        threadId: 'thread-009',
        from: 'Notion <notify@mail.notion.so>',
        to: [demoEmail],
        subject: 'New comment on "Product Roadmap Q2 2026"',
        snippet: '@demo mentioned you in a comment: "Can you confirm the AI inbox triage is ready for the May launch?"',
        labels: ['INBOX'],
        daysAgoN: 7,
      },
      {
        id: '60000000-0000-0000-0000-000000000010',
        threadId: 'thread-010',
        from: 'Figma <notify@figma.com>',
        to: [demoEmail],
        subject: 'Anna shared "MailZen Design System v2" with you',
        snippet: 'Anna Rodriguez shared a file with you. You can now view and comment on "MailZen Design System v2".',
        labels: ['INBOX'],
        daysAgoN: 8,
      },
      // Archived threads
      {
        id: '60000000-0000-0000-0000-000000000011',
        threadId: 'thread-011',
        from: 'LinkedIn <jobs-noreply@linkedin.com>',
        to: [demoEmail],
        subject: '10 jobs matching "Full Stack Engineer"',
        snippet: 'Based on your profile and activity, here are 10 new job opportunities that match your skills.',
        labels: [],
        daysAgoN: 10,
      },
      // Sent thread
      {
        id: '60000000-0000-0000-0000-000000000012',
        threadId: 'thread-012',
        from: 'Demo User <demo@mailzen.dev>',
        to: ['team@mailzen.dev'],
        subject: 'Sprint 12 Goals — AI Smart Reply Launch',
        snippet: 'Team, here are the goals for Sprint 12. Primary focus is the smart reply auto-send feature and the thread insights API.',
        labels: ['SENT'],
        daysAgoN: 4,
      },
    ];

    for (const t of threads) {
      const textBody = bodyFromSnippet(t.subject, t.snippet);
      await client.query(`
        INSERT INTO external_email_messages
          (id, "userId", "providerId", "externalMessageId", "threadId",
           "from", "to", subject, snippet, "textBody", "internalDate", labels)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT ("providerId", "externalMessageId") DO UPDATE SET
          "threadId" = EXCLUDED."threadId",
          "from" = EXCLUDED."from",
          "to" = EXCLUDED."to",
          subject = EXCLUDED.subject,
          snippet = EXCLUDED.snippet,
          "textBody" = EXCLUDED."textBody",
          "internalDate" = EXCLUDED."internalDate",
          labels = EXCLUDED.labels
      `, [
        t.id,
        userId,
        providerId,
        t.id, // use id as externalMessageId for demo
        t.threadId,
        t.from,
        t.to,
        t.subject,
        t.snippet,
        textBody,
        daysAgo(t.daysAgoN),
        t.labels,
      ]);
    }

    // -----------------------------------------------------------------------
    // 9. Contacts
    // -----------------------------------------------------------------------
    console.log('👥  Seeding contacts…');
    const contacts = [
      { name: 'Sarah Connor', email: 'sarah@acme.com',    phone: '+14155552671' },
      { name: 'John Doe',     email: 'john@startup.io',   phone: null },
      { name: 'Anna Rodriguez', email: 'anna@mailzen.dev', phone: null },
    ];
    for (const c of contacts) {
      await client.query(`
        INSERT INTO contacts (id, name, email, phone, "userId")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [randomUUID(), c.name, c.email, c.phone, userId]);
    }

    // -----------------------------------------------------------------------
    // 10. Notification preferences
    // -----------------------------------------------------------------------
    console.log('🔔  Seeding notification preferences…');
    await client.query(`
      INSERT INTO user_notification_preferences
        (id, "userId", "inAppEnabled", "emailEnabled", "pushEnabled", "syncFailureEnabled")
      VALUES
        ($1, $2, true, true, false, true)
      ON CONFLICT ("userId") DO UPDATE SET
        "inAppEnabled" = EXCLUDED."inAppEnabled",
        "emailEnabled" = EXCLUDED."emailEnabled",
        "pushEnabled" = EXCLUDED."pushEnabled",
        "syncFailureEnabled" = EXCLUDED."syncFailureEnabled"
    `, [DEMO_NOTIFICATION_PREFS_ID, userId]);

    // -----------------------------------------------------------------------
    // Done
    // -----------------------------------------------------------------------
    console.log(`
✅  Seed complete!

  Login credentials:
  ─────────────────────────────────
  URL:       http://localhost:3000/auth/login
  Email:     demo@mailzen.dev
  Password:  Demo@1234
  ─────────────────────────────────

  12 demo email threads seeded (inbox, sent, archived)
  4 labels, 3 contacts, 3 billing plans
`);
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
