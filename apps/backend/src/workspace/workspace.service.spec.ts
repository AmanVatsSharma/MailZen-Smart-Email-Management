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
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorkspaceMember>>;
    userRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    billingService = {
      getEntitlements: jest.fn().mockResolvedValue({
        planCode: 'PRO',
        providerLimit: 5,
        mailboxLimit: 5,
        workspaceLimit: 5,
        aiCreditsPerMonth: 500,
      }),
    };
    workspaceRepo.count.mockResolvedValue(1);

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

  it('rejects workspace creation when entitlement limit reached', async () => {
    workspaceRepo.findOne.mockResolvedValue(null);
    workspaceRepo.count.mockResolvedValue(5);
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      aiCreditsPerMonth: 500,
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
});
