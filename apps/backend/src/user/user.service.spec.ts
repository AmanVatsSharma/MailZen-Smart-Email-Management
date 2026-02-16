import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { BillingInvoice } from '../billing/entities/billing-invoice.entity';
import { UserSubscription } from '../billing/entities/user-subscription.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let auditLogRepository: jest.Mocked<Repository<AuditLog>>;
  let emailProviderRepository: jest.Mocked<Repository<EmailProvider>>;
  let mailboxRepository: jest.Mocked<Repository<Mailbox>>;
  let workspaceMemberRepository: jest.Mocked<Repository<WorkspaceMember>>;
  let userSubscriptionRepository: jest.Mocked<Repository<UserSubscription>>;
  let billingInvoiceRepository: jest.Mocked<Repository<BillingInvoice>>;
  let userNotificationRepository: jest.Mocked<Repository<UserNotification>>;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    auditLogRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    emailProviderRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    mailboxRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mailbox>>;
    workspaceMemberRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorkspaceMember>>;
    userSubscriptionRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserSubscription>>;
    billingInvoiceRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<BillingInvoice>>;
    userNotificationRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;

    service = new UserService(
      userRepository,
      auditLogRepository,
      emailProviderRepository,
      mailboxRepository,
      workspaceMemberRepository,
      userSubscriptionRepository,
      billingInvoiceRepository,
      userNotificationRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exports consolidated user account data snapshot', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      role: 'USER',
      isEmailVerified: true,
      isPhoneVerified: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    } as User);
    emailProviderRepository.find.mockResolvedValue([
      {
        id: 'provider-1',
        type: 'GMAIL',
        email: 'user@example.com',
        status: 'connected',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      } as EmailProvider,
    ]);
    mailboxRepository.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'alias@mailzen.com',
        status: 'ACTIVE',
        workspaceId: null,
        quotaLimitMb: 51200,
        usedBytes: '1024',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      } as Mailbox,
    ]);
    workspaceMemberRepository.find.mockResolvedValue([
      {
        id: 'member-1',
        workspaceId: 'workspace-1',
        email: 'user@example.com',
        role: 'OWNER',
        status: 'active',
        invitedByUserId: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      } as WorkspaceMember,
    ]);
    userSubscriptionRepository.findOne.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      planCode: 'PRO',
      status: 'active',
      startedAt: new Date('2026-02-01T00:00:00.000Z'),
      endsAt: null,
      isTrial: false,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    } as UserSubscription);
    billingInvoiceRepository.find.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNumber: 'MZ-202602-001',
        planCode: 'PRO',
        status: 'paid',
        amountCents: 1900,
        currency: 'USD',
        provider: 'INTERNAL',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      } as BillingInvoice,
    ]);
    userNotificationRepository.find.mockResolvedValue([
      {
        id: 'noti-1',
        type: 'SYNC_FAILED',
        title: 'Sync failed',
        isRead: false,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      } as UserNotification,
    ]);

    const result = await service.exportUserDataSnapshot('user-1');

    expect(result.generatedAtIso).toBeTruthy();
    expect(result.dataJson).toContain('"providers"');
    expect(result.dataJson).toContain('"mailboxes"');
    expect(result.dataJson).toContain('"workspaceMemberships"');
    expect(result.dataJson).toContain('"notificationSummary"');
    expect(auditLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'user_data_export_requested',
      }),
    );
  });

  it('does not fail account export when audit write fails', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      isEmailVerified: true,
      isPhoneVerified: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    } as User);
    emailProviderRepository.find.mockResolvedValue([]);
    mailboxRepository.find.mockResolvedValue([]);
    workspaceMemberRepository.find.mockResolvedValue([]);
    userSubscriptionRepository.findOne.mockResolvedValue(null);
    billingInvoiceRepository.find.mockResolvedValue([]);
    userNotificationRepository.find.mockResolvedValue([]);
    auditLogRepository.save.mockRejectedValueOnce(
      new Error('audit store unavailable'),
    );

    const result = await service.exportUserDataSnapshot('user-1');

    expect(result.generatedAtIso).toBeTruthy();
    expect(result.dataJson).toContain('"user"');
    expect(auditLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'user_data_export_requested',
      }),
    );
  });
});
