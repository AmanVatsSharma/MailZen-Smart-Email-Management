/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { User } from '../user/entities/user.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let workspaceRepo: jest.Mocked<Repository<Workspace>>;
  let workspaceMemberRepo: jest.Mocked<Repository<WorkspaceMember>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let billingService: jest.Mocked<Pick<BillingService, 'getEntitlements'>>;

  beforeEach(() => {
    workspaceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<Repository<Workspace>>;
    workspaceMemberRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorkspaceMember>>;
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    billingService = {
      getEntitlements: jest.fn().mockResolvedValue({
        planCode: 'PRO',
        providerLimit: 5,
        mailboxLimit: 5,
        workspaceLimit: 5,
        workspaceMemberLimit: 25,
        aiCreditsPerMonth: 500,
        mailboxStorageLimitMb: 10240,
      }),
    };
    workspaceRepo.count.mockResolvedValue(1);
    workspaceMemberRepo.count.mockResolvedValue(1);

    service = new WorkspaceService(
      workspaceRepo,
      workspaceMemberRepo,
      userRepo,
      billingService as unknown as BillingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates workspace with owner membership', async () => {
    workspaceRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
      name: 'Owner User',
    } as User);
    workspaceRepo.create.mockImplementation(
      (value: Partial<Workspace>) => value as Workspace,
    );
    workspaceRepo.save
      .mockResolvedValueOnce({
        id: 'personal-1',
        ownerUserId: 'user-1',
        name: "Owner User's Workspace",
        slug: 'owner-users-workspace',
        isPersonal: true,
      } as Workspace)
      .mockResolvedValueOnce({
        id: 'workspace-1',
        ownerUserId: 'user-1',
        name: 'Sales Team',
        slug: 'sales-team',
        isPersonal: false,
      } as Workspace);
    workspaceMemberRepo.create.mockImplementation(
      (value: Partial<WorkspaceMember>) => value as WorkspaceMember,
    );
    workspaceMemberRepo.save.mockResolvedValue({} as WorkspaceMember);

    const result = await service.createWorkspace('user-1', 'Sales Team');

    expect(result.name).toBe('Sales Team');
    expect(workspaceMemberRepo.save).toHaveBeenCalled();
  });

  it('rejects member invite when actor is not owner/admin', async () => {
    workspaceMemberRepo.findOne.mockResolvedValue({
      id: 'member-1',
      workspaceId: 'workspace-1',
      userId: 'user-2',
      role: 'MEMBER',
      status: 'active',
    } as WorkspaceMember);

    await expect(
      service.inviteWorkspaceMember(
        'workspace-1',
        'user-2',
        'invitee@example.com',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects direct active member invite when workspace seat limit is reached', async () => {
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'FREE',
      providerLimit: 1,
      mailboxLimit: 1,
      workspaceLimit: 1,
      workspaceMemberLimit: 2,
      aiCreditsPerMonth: 50,
      mailboxStorageLimitMb: 2048,
    });
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'actor-member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember)
      .mockResolvedValueOnce(null);
    workspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      ownerUserId: 'owner-user-1',
      name: 'Workspace One',
      slug: 'workspace-one',
      isPersonal: false,
    } as Workspace);
    userRepo.findOne.mockResolvedValue({
      id: 'user-2',
      email: 'teammate@example.com',
    } as User);
    workspaceMemberRepo.count.mockResolvedValue(2);

    await expect(
      service.inviteWorkspaceMember(
        'workspace-1',
        'user-1',
        'teammate@example.com',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects workspace creation when entitlement limit reached', async () => {
    workspaceRepo.findOne.mockResolvedValue(null);
    workspaceRepo.count.mockResolvedValue(5);
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      workspaceMemberLimit: 25,
      aiCreditsPerMonth: 500,
      mailboxStorageLimitMb: 10240,
    });
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
      name: 'Owner User',
    } as User);
    workspaceRepo.create.mockImplementation(
      (value: Partial<Workspace>) => value as Workspace,
    );
    workspaceRepo.save.mockResolvedValueOnce({
      id: 'personal-1',
      ownerUserId: 'user-1',
      name: "Owner User's Workspace",
      slug: 'owner-users-workspace',
      isPersonal: true,
    } as Workspace);
    workspaceMemberRepo.create.mockImplementation(
      (value: Partial<WorkspaceMember>) => value as WorkspaceMember,
    );
    workspaceMemberRepo.save.mockResolvedValue({} as WorkspaceMember);

    await expect(
      service.createWorkspace('user-1', 'Blocked Workspace'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets active workspace for authorized member', async () => {
    workspaceMemberRepo.findOne.mockResolvedValue({
      id: 'member-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'OWNER',
      status: 'active',
    } as WorkspaceMember);
    workspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      ownerUserId: 'user-1',
      name: 'Workspace One',
      slug: 'workspace-one',
      isPersonal: false,
    } as Workspace);
    userRepo.update.mockResolvedValue({} as any);

    const result = await service.setActiveWorkspace('user-1', 'workspace-1');

    expect(userRepo.update).toHaveBeenCalledWith('user-1', {
      activeWorkspaceId: 'workspace-1',
    });
    expect(result.id).toBe('workspace-1');
  });

  it('lists pending invitations for user email', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@mailzen.com',
    } as User);
    workspaceMemberRepo.find.mockResolvedValue([
      {
        id: 'member-1',
        workspaceId: 'workspace-1',
        email: 'invitee@mailzen.com',
        status: 'pending',
      } as WorkspaceMember,
    ]);

    const invitations = await service.listPendingWorkspaceInvitations('user-1');

    expect(invitations).toHaveLength(1);
    expect(workspaceMemberRepo.find).toHaveBeenCalledWith({
      where: {
        email: 'invitee@mailzen.com',
        status: 'pending',
      },
      order: { createdAt: 'ASC' },
    });
  });

  it('accepts invitation when pending email matches user', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@mailzen.com',
    } as User);
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'member-1',
        workspaceId: 'workspace-1',
        email: 'invitee@mailzen.com',
        status: 'pending',
      } as WorkspaceMember)
      .mockResolvedValueOnce(null);
    workspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      ownerUserId: 'owner-user-1',
      name: 'Workspace One',
      slug: 'workspace-one',
      isPersonal: false,
    } as Workspace);
    workspaceMemberRepo.save.mockImplementation((member: WorkspaceMember) =>
      Promise.resolve(member),
    );

    const result = await service.respondToWorkspaceInvitation({
      workspaceMemberId: 'member-1',
      userId: 'user-1',
      accept: true,
    });

    expect(result.status).toBe('active');
    expect(result.userId).toBe('user-1');
  });

  it('rejects invitation accept when workspace member limit is reached', async () => {
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'FREE',
      providerLimit: 1,
      mailboxLimit: 1,
      workspaceLimit: 1,
      workspaceMemberLimit: 2,
      aiCreditsPerMonth: 50,
      mailboxStorageLimitMb: 2048,
    });
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'invitee@mailzen.com',
    } as User);
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'member-1',
        workspaceId: 'workspace-1',
        email: 'invitee@mailzen.com',
        status: 'pending',
      } as WorkspaceMember)
      .mockResolvedValueOnce(null);
    workspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      ownerUserId: 'owner-user-1',
      name: 'Workspace One',
      slug: 'workspace-one',
      isPersonal: false,
    } as Workspace);
    workspaceMemberRepo.count.mockResolvedValue(2);

    await expect(
      service.respondToWorkspaceInvitation({
        workspaceMemberId: 'member-1',
        userId: 'user-1',
        accept: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exports workspace membership snapshot for authorized user', async () => {
    workspaceMemberRepo.findOne.mockResolvedValue({
      id: 'member-actor-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'OWNER',
      status: 'active',
    } as WorkspaceMember);
    workspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      ownerUserId: 'user-1',
      name: 'Sales Team',
      slug: 'sales-team',
      isPersonal: false,
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
      updatedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as Workspace);
    workspaceMemberRepo.find.mockResolvedValue([
      {
        id: 'member-actor-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        email: 'owner@mailzen.com',
        role: 'OWNER',
        status: 'active',
        invitedByUserId: 'user-1',
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      } as WorkspaceMember,
    ]);
    userRepo.find.mockResolvedValue([
      {
        id: 'user-1',
        email: 'owner@mailzen.com',
        name: 'Owner',
        activeWorkspaceId: 'workspace-1',
      } as User,
    ]);

    const result = await service.exportWorkspaceData({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });
    const parsedPayload = JSON.parse(result.dataJson) as {
      workspace: { id: string; name: string };
      members: Array<{ role: string }>;
    };

    expect(parsedPayload.workspace).toMatchObject({
      id: 'workspace-1',
      name: 'Sales Team',
    });
    expect(parsedPayload.members).toHaveLength(1);
    expect(parsedPayload.members[0]?.role).toBe('OWNER');
  });

  it('rejects invitation response when email does not match user', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'owner@mailzen.com',
    } as User);
    workspaceMemberRepo.findOne.mockResolvedValue({
      id: 'member-1',
      workspaceId: 'workspace-1',
      email: 'invitee@mailzen.com',
      status: 'pending',
    } as WorkspaceMember);

    await expect(
      service.respondToWorkspaceInvitation({
        workspaceMemberId: 'member-1',
        userId: 'user-1',
        accept: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates member role when actor has owner/admin access', async () => {
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'member-2',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: 'MEMBER',
        status: 'active',
      } as WorkspaceMember)
      .mockResolvedValueOnce({
        id: 'actor-member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember);
    workspaceMemberRepo.save.mockImplementation((member: WorkspaceMember) =>
      Promise.resolve(member),
    );

    const updated = await service.updateWorkspaceMemberRole({
      workspaceMemberId: 'member-2',
      actorUserId: 'user-1',
      role: 'ADMIN',
    });

    expect(updated.role).toBe('ADMIN');
  });

  it('prevents demoting the last workspace owner', async () => {
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'member-owner',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember)
      .mockResolvedValueOnce({
        id: 'member-owner',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember);
    workspaceMemberRepo.find.mockResolvedValue([
      {
        id: 'member-owner',
        workspaceId: 'workspace-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember,
    ]);

    await expect(
      service.updateWorkspaceMemberRole({
        workspaceMemberId: 'member-owner',
        actorUserId: 'user-1',
        role: 'MEMBER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes workspace member and clears active workspace', async () => {
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'member-2',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: 'MEMBER',
        status: 'active',
      } as WorkspaceMember)
      .mockResolvedValueOnce({
        id: 'actor-member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember);
    workspaceMemberRepo.save.mockImplementation((member: WorkspaceMember) =>
      Promise.resolve(member),
    );
    userRepo.update.mockResolvedValue({} as any);

    const removed = await service.removeWorkspaceMember({
      workspaceMemberId: 'member-2',
      actorUserId: 'user-1',
    });

    expect(removed.status).toBe('removed');
    expect(userRepo.update).toHaveBeenCalledWith('user-2', {
      activeWorkspaceId: undefined,
    });
  });

  it('reinvites declined member as pending', async () => {
    workspaceMemberRepo.findOne
      .mockResolvedValueOnce({
        id: 'actor-member-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER',
        status: 'active',
      } as WorkspaceMember)
      .mockResolvedValueOnce({
        id: 'member-declined-1',
        workspaceId: 'workspace-1',
        email: 'invitee@example.com',
        role: 'MEMBER',
        status: 'declined',
      } as WorkspaceMember);
    workspaceRepo.findOne.mockResolvedValue({
      id: 'workspace-1',
      ownerUserId: 'user-1',
      name: 'Workspace One',
      slug: 'workspace-one',
      isPersonal: false,
    } as Workspace);
    workspaceMemberRepo.save.mockImplementation((member: WorkspaceMember) =>
      Promise.resolve(member),
    );

    const reinvited = await service.inviteWorkspaceMember(
      'workspace-1',
      'user-1',
      'invitee@example.com',
      'admin',
    );

    expect(reinvited.status).toBe('pending');
    expect(reinvited.role).toBe('ADMIN');
  });
});
