import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepo: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private normalizeWorkspaceName(name: string): string {
    const normalized = String(name || '').trim();
    if (normalized.length < 2) {
      throw new BadRequestException(
        'Workspace name must be at least 2 characters',
      );
    }
    return normalized.slice(0, 80);
  }

  private slugifyWorkspaceName(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return base || `workspace-${Date.now()}`;
  }

  private async createUniqueSlug(baseName: string): Promise<string> {
    let slug = this.slugifyWorkspaceName(baseName);
    let suffix = 0;

    while (true) {
      const existing = await this.workspaceRepo.findOne({ where: { slug } });
      if (!existing) return slug;
      suffix += 1;
      slug = `${this.slugifyWorkspaceName(baseName)}-${suffix}`;
    }
  }

  async getOrCreatePersonalWorkspace(userId: string): Promise<Workspace> {
    const existing = await this.workspaceRepo.findOne({
      where: { ownerUserId: userId, isPersonal: true },
    });
    if (existing) return existing;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const workspaceName =
      (user?.name && `${user.name}'s Workspace`) || 'My Workspace';
    const slug = await this.createUniqueSlug(workspaceName);
    const created = await this.workspaceRepo.save(
      this.workspaceRepo.create({
        ownerUserId: userId,
        name: workspaceName,
        slug,
        isPersonal: true,
      }),
    );
    await this.workspaceMemberRepo.save(
      this.workspaceMemberRepo.create({
        workspaceId: created.id,
        userId,
        email: user?.email || `${userId}@local.user`,
        role: 'OWNER',
        status: 'active',
        invitedByUserId: userId,
      }),
    );
    return created;
  }

  async createWorkspace(userId: string, name: string): Promise<Workspace> {
    await this.getOrCreatePersonalWorkspace(userId);
    const normalizedName = this.normalizeWorkspaceName(name);
    const slug = await this.createUniqueSlug(normalizedName);
    const created = await this.workspaceRepo.save(
      this.workspaceRepo.create({
        ownerUserId: userId,
        name: normalizedName,
        slug,
        isPersonal: false,
      }),
    );

    const ownerUser = await this.userRepo.findOne({ where: { id: userId } });
    await this.workspaceMemberRepo.save(
      this.workspaceMemberRepo.create({
        workspaceId: created.id,
        userId,
        email: ownerUser?.email || `${userId}@local.user`,
        role: 'OWNER',
        status: 'active',
        invitedByUserId: userId,
      }),
    );

    return created;
  }

  async listMyWorkspaces(userId: string): Promise<Workspace[]> {
    await this.getOrCreatePersonalWorkspace(userId);
    const memberships = await this.workspaceMemberRepo.find({
      where: { userId, status: 'active' },
      order: { createdAt: 'ASC' },
    });
    const workspaceIds = memberships.map(
      (membership) => membership.workspaceId,
    );
    if (!workspaceIds.length) return [];

    const workspaces = await this.workspaceRepo.find({
      where: { id: In(workspaceIds) },
      order: { createdAt: 'ASC' },
    });
    return workspaces;
  }

  private async assertWorkspaceAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const membership = await this.workspaceMemberRepo.findOne({
      where: { workspaceId, userId, status: 'active' },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }
    return membership;
  }

  async listWorkspaceMembers(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember[]> {
    await this.assertWorkspaceAccess(workspaceId, userId);
    return this.workspaceMemberRepo.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async inviteWorkspaceMember(
    workspaceId: string,
    actorUserId: string,
    email: string,
    role = 'MEMBER',
  ): Promise<WorkspaceMember> {
    const actorMembership = await this.assertWorkspaceAccess(
      workspaceId,
      actorUserId,
    );
    if (!['OWNER', 'ADMIN'].includes(actorMembership.role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can invite members to workspace',
      );
    }

    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail.includes('@')) {
      throw new BadRequestException('Valid member email is required');
    }

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const existingMember = await this.workspaceMemberRepo.findOne({
      where: { workspaceId, email: normalizedEmail },
    });
    if (existingMember) return existingMember;

    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    const member = this.workspaceMemberRepo.create({
      workspaceId,
      userId: user?.id || null,
      email: normalizedEmail,
      role,
      status: user ? 'active' : 'pending',
      invitedByUserId: actorUserId,
    });
    return this.workspaceMemberRepo.save(member);
  }
}
