import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { BillingService } from '../billing/billing.service';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { User } from '../user/entities/user.entity';
import { WorkspaceDataExportResponse } from './workspace-data-export.response';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepo: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly billingService: BillingService,
  ) {}

  private async writeAuditLog(input: {
    userId?: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditLogRepo.save(
        this.auditLogRepo.create({
          userId: input.userId,
          action: input.action,
          metadata: input.metadata || {},
        }),
      );
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'workspace_audit_log_write_failed',
          userId: input.userId || null,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  private normalizeWorkspaceName(name: string): string {
    const normalized = String(name || '').trim();
    if (normalized.length < 2) {
      throw new BadRequestException(
        'Workspace name must be at least 2 characters',
      );
    }
    return normalized.slice(0, 80);
  }

  private normalizeWorkspaceRole(role: string): string {
    const normalized = String(role || '')
      .trim()
      .toUpperCase();
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(normalized)) {
      throw new BadRequestException(
        'Workspace role must be OWNER, ADMIN, or MEMBER',
      );
    }
    return normalized;
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
    await this.enforceWorkspaceLimit(userId);
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
    await this.writeAuditLog({
      userId,
      action: 'workspace_created',
      metadata: {
        workspaceId: created.id,
        workspaceSlug: created.slug,
        workspaceName: created.name,
        isPersonal: false,
      },
    });

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

  async getActiveWorkspace(userId: string): Promise<Workspace | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const workspaces = await this.listMyWorkspaces(userId);
    if (!workspaces.length) return null;

    const activeWorkspace =
      workspaces.find(
        (workspace) => workspace.id === user?.activeWorkspaceId,
      ) ||
      workspaces.find((workspace) => workspace.isPersonal) ||
      workspaces[0];

    if (activeWorkspace && user?.activeWorkspaceId !== activeWorkspace.id) {
      await this.userRepo.update(userId, {
        activeWorkspaceId: activeWorkspace.id,
      });
    }
    return activeWorkspace || null;
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

  private async assertWorkspaceAdminAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember> {
    const membership = await this.assertWorkspaceAccess(workspaceId, userId);
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new ForbiddenException(
        'Only OWNER/ADMIN can manage workspace members',
      );
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

  async listPendingWorkspaceInvitations(
    userId: string,
  ): Promise<WorkspaceMember[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const normalizedEmail = String(user?.email || '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) return [];

    return this.workspaceMemberRepo.find({
      where: {
        email: normalizedEmail,
        status: 'pending',
      },
      order: { createdAt: 'ASC' },
    });
  }

  async exportWorkspaceData(input: {
    workspaceId: string;
    userId: string;
  }): Promise<WorkspaceDataExportResponse> {
    const membership = await this.assertWorkspaceAccess(
      input.workspaceId,
      input.userId,
    );
    const workspace = await this.workspaceRepo.findOne({
      where: { id: input.workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const members = await this.workspaceMemberRepo.find({
      where: { workspaceId: input.workspaceId },
      order: { createdAt: 'ASC' },
    });
    const memberUserIds = members
      .map((member) => String(member.userId || '').trim())
      .filter((memberUserId) => memberUserId.length > 0);
    const memberUsers = memberUserIds.length
      ? await this.userRepo.find({
          where: { id: In(memberUserIds) },
        })
      : [];
    const userById = new Map(memberUsers.map((user) => [user.id, user]));
    const generatedAt = new Date();

    const payload = {
      generatedAtIso: generatedAt.toISOString(),
      workspace: {
        id: workspace.id,
        ownerUserId: workspace.ownerUserId,
        name: workspace.name,
        slug: workspace.slug,
        isPersonal: workspace.isPersonal,
        createdAtIso: workspace.createdAt.toISOString(),
        updatedAtIso: workspace.updatedAt.toISOString(),
      },
      requester: {
        userId: input.userId,
        role: membership.role,
      },
      members: members.map((member) => {
        const user = member.userId ? userById.get(member.userId) : undefined;
        return {
          id: member.id,
          userId: member.userId || null,
          email: member.email,
          role: member.role,
          status: member.status,
          invitedByUserId: member.invitedByUserId || null,
          createdAtIso: member.createdAt.toISOString(),
          updatedAtIso: member.updatedAt.toISOString(),
          userProfile: user
            ? {
                id: user.id,
                email: user.email,
                name: user.name,
                activeWorkspaceId: user.activeWorkspaceId || null,
              }
            : null,
        };
      }),
    };

    return {
      generatedAtIso: generatedAt.toISOString(),
      dataJson: JSON.stringify(payload),
    };
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
    const normalizedRole = this.normalizeWorkspaceRole(role);
    if (!normalizedEmail.includes('@')) {
      throw new BadRequestException('Valid member email is required');
    }

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const user = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });

    const existingMember = await this.workspaceMemberRepo.findOne({
      where: { workspaceId, email: normalizedEmail },
    });
    if (existingMember) {
      if (['declined', 'removed'].includes(existingMember.status)) {
        if (user) {
          await this.enforceWorkspaceMemberLimit(workspace.ownerUserId, {
            workspaceId,
            excludeMemberId: existingMember.id,
          });
        }
        existingMember.role = normalizedRole;
        existingMember.status = user ? 'active' : 'pending';
        existingMember.invitedByUserId = actorUserId;
        existingMember.userId = user?.id || null;
        const savedMember = await this.workspaceMemberRepo.save(existingMember);
        await this.writeAuditLog({
          userId: actorUserId,
          action: 'workspace_member_invited',
          metadata: {
            workspaceId,
            workspaceMemberId: savedMember.id,
            invitedUserId: savedMember.userId || null,
            invitedEmailFingerprint: fingerprintIdentifier(normalizedEmail),
            role: normalizedRole,
            status: savedMember.status,
            invitedViaReactivation: true,
          },
        });
        return savedMember;
      }
      return existingMember;
    }
    if (user) {
      await this.enforceWorkspaceMemberLimit(workspace.ownerUserId, {
        workspaceId,
      });
    }
    const member = this.workspaceMemberRepo.create({
      workspaceId,
      userId: user?.id || null,
      email: normalizedEmail,
      role: normalizedRole,
      status: user ? 'active' : 'pending',
      invitedByUserId: actorUserId,
    });
    const savedMember = await this.workspaceMemberRepo.save(member);
    await this.writeAuditLog({
      userId: actorUserId,
      action: 'workspace_member_invited',
      metadata: {
        workspaceId,
        workspaceMemberId: savedMember.id,
        invitedUserId: savedMember.userId || null,
        invitedEmailFingerprint: fingerprintIdentifier(normalizedEmail),
        role: normalizedRole,
        status: savedMember.status,
        invitedViaReactivation: false,
      },
    });
    return savedMember;
  }

  async respondToWorkspaceInvitation(input: {
    workspaceMemberId: string;
    userId: string;
    accept: boolean;
  }): Promise<WorkspaceMember> {
    const user = await this.userRepo.findOne({ where: { id: input.userId } });
    if (!user?.email) {
      throw new BadRequestException('Authenticated user email is required');
    }

    const invitation = await this.workspaceMemberRepo.findOne({
      where: { id: input.workspaceMemberId },
    });
    if (!invitation) {
      throw new NotFoundException('Workspace invitation not found');
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        'Workspace invitation is no longer pending',
      );
    }

    const invitationEmail = String(invitation.email || '')
      .trim()
      .toLowerCase();
    const currentUserEmail = String(user.email || '')
      .trim()
      .toLowerCase();
    if (!invitationEmail || invitationEmail !== currentUserEmail) {
      throw new ForbiddenException(
        'You can only respond to invitations sent to your email',
      );
    }

    if (input.accept) {
      const workspace = await this.workspaceRepo.findOne({
        where: { id: invitation.workspaceId },
      });
      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }
      await this.enforceWorkspaceMemberLimit(workspace.ownerUserId, {
        workspaceId: invitation.workspaceId,
        excludeMemberId: invitation.id,
      });
    }

    invitation.userId = input.userId;
    invitation.status = input.accept ? 'active' : 'declined';
    const savedInvitation = await this.workspaceMemberRepo.save(invitation);
    await this.writeAuditLog({
      userId: input.userId,
      action: 'workspace_invitation_responded',
      metadata: {
        workspaceId: invitation.workspaceId,
        workspaceMemberId: invitation.id,
        accepted: input.accept,
        resultingStatus: savedInvitation.status,
      },
    });
    return savedInvitation;
  }

  async updateWorkspaceMemberRole(input: {
    workspaceMemberId: string;
    actorUserId: string;
    role: string;
  }): Promise<WorkspaceMember> {
    const member = await this.workspaceMemberRepo.findOne({
      where: { id: input.workspaceMemberId },
    });
    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }
    const normalizedRole = this.normalizeWorkspaceRole(input.role);
    const actorMembership = await this.assertWorkspaceAdminAccess(
      member.workspaceId,
      input.actorUserId,
    );
    if (normalizedRole === 'OWNER' && actorMembership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only workspace OWNER can promote a member to OWNER',
      );
    }
    if (member.role === 'OWNER' && normalizedRole !== 'OWNER') {
      const activeOwners = await this.workspaceMemberRepo.find({
        where: {
          workspaceId: member.workspaceId,
          role: 'OWNER',
          status: 'active',
        },
      });
      if (activeOwners.length <= 1) {
        throw new BadRequestException('Workspace must always have one OWNER');
      }
    }
    const previousRole = member.role;
    member.role = normalizedRole;
    const savedMember = await this.workspaceMemberRepo.save(member);
    await this.writeAuditLog({
      userId: input.actorUserId,
      action: 'workspace_member_role_updated',
      metadata: {
        workspaceId: member.workspaceId,
        workspaceMemberId: member.id,
        previousRole,
        role: savedMember.role,
        targetUserId: member.userId || null,
      },
    });
    return savedMember;
  }

  async removeWorkspaceMember(input: {
    workspaceMemberId: string;
    actorUserId: string;
  }): Promise<WorkspaceMember> {
    const member = await this.workspaceMemberRepo.findOne({
      where: { id: input.workspaceMemberId },
    });
    if (!member) {
      throw new NotFoundException('Workspace member not found');
    }
    const actorMembership = await this.assertWorkspaceAdminAccess(
      member.workspaceId,
      input.actorUserId,
    );
    if (member.role === 'OWNER' && actorMembership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only workspace OWNER can remove an OWNER member',
      );
    }
    if (member.role === 'OWNER') {
      const activeOwners = await this.workspaceMemberRepo.find({
        where: {
          workspaceId: member.workspaceId,
          role: 'OWNER',
          status: 'active',
        },
      });
      if (activeOwners.length <= 1) {
        throw new BadRequestException('Workspace must always have one OWNER');
      }
    }
    member.status = 'removed';
    const saved = await this.workspaceMemberRepo.save(member);
    if (member.userId) {
      await this.userRepo.update(member.userId, {
        activeWorkspaceId: undefined,
      });
    }
    await this.writeAuditLog({
      userId: input.actorUserId,
      action: 'workspace_member_removed',
      metadata: {
        workspaceId: member.workspaceId,
        workspaceMemberId: member.id,
        role: member.role,
        removedUserId: member.userId || null,
      },
    });
    return saved;
  }

  async setActiveWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<Workspace> {
    await this.assertWorkspaceAccess(workspaceId, userId);
    await this.userRepo.update(userId, {
      activeWorkspaceId: workspaceId,
    });
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    await this.writeAuditLog({
      userId,
      action: 'workspace_active_set',
      metadata: {
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
      },
    });
    return workspace;
  }

  private async enforceWorkspaceLimit(userId: string): Promise<void> {
    const entitlements = await this.billingService.getEntitlements(userId);
    const existingWorkspaceCount = await this.workspaceRepo.count({
      where: { ownerUserId: userId },
    });
    if (existingWorkspaceCount >= entitlements.workspaceLimit) {
      throw new BadRequestException(
        `Plan limit reached. Your ${entitlements.planCode} plan supports up to ${entitlements.workspaceLimit} workspaces.`,
      );
    }
  }

  private async enforceWorkspaceMemberLimit(
    ownerUserId: string,
    input: {
      workspaceId: string;
      excludeMemberId?: string;
    },
  ): Promise<void> {
    const entitlements = await this.billingService.getEntitlements(ownerUserId);
    let activeMemberCount = await this.workspaceMemberRepo.count({
      where: { workspaceId: input.workspaceId, status: 'active' },
    });
    const normalizedExcludeMemberId = String(
      input.excludeMemberId || '',
    ).trim();
    if (normalizedExcludeMemberId) {
      const excludedMember = await this.workspaceMemberRepo.findOne({
        where: {
          id: normalizedExcludeMemberId,
          workspaceId: input.workspaceId,
          status: 'active',
        },
      });
      if (excludedMember && activeMemberCount > 0) {
        activeMemberCount -= 1;
      }
    }
    if (activeMemberCount < entitlements.workspaceMemberLimit) return;

    this.logger.warn(
      serializeStructuredLog({
        event: 'workspace_member_limit_reached',
        workspaceId: input.workspaceId,
        ownerUserId,
        activeMembers: activeMemberCount,
        limit: entitlements.workspaceMemberLimit,
      }),
    );
    throw new BadRequestException(
      `Plan limit reached. Your ${entitlements.planCode} plan supports up to ${entitlements.workspaceMemberLimit} active members per workspace.`,
    );
  }
}
