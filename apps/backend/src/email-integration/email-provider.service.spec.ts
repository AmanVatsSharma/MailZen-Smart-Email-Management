/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { GmailSyncService } from '../gmail-sync/gmail-sync.service';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { OutlookSyncService } from '../outlook-sync/outlook-sync.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { EmailProviderInput } from './dto/email-provider.input';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  }),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn().mockResolvedValue({
      credentials: {
        access_token: 'refreshed-access-token',
        expiry_date: Date.now() + 3600000,
      },
    }),
  })),
}));

describe('EmailProviderService', () => {
  let service: EmailProviderService;
  let providerRepository: jest.Mocked<Repository<EmailProvider>>;
  let notificationRepository: jest.Mocked<Repository<UserNotification>>;
  const gmailSyncServiceMock = {
    syncGmailProvider: jest.fn(),
  };
  const outlookSyncServiceMock = {
    syncOutlookProvider: jest.fn(),
  };
  const billingServiceMock = {
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
  const workspaceServiceMock = {
    listMyWorkspaces: jest.fn().mockResolvedValue([
      {
        id: 'workspace-1',
        isPersonal: true,
      },
    ]),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(global, 'setInterval').mockImplementation((() => 0) as any);

    const repoMock = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    const notificationRepoMock = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserNotification>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderService,
        { provide: getRepositoryToken(EmailProvider), useValue: repoMock },
        {
          provide: getRepositoryToken(UserNotification),
          useValue: notificationRepoMock,
        },
        { provide: BillingService, useValue: billingServiceMock },
        { provide: WorkspaceService, useValue: workspaceServiceMock },
        { provide: GmailSyncService, useValue: gmailSyncServiceMock },
        { provide: OutlookSyncService, useValue: outlookSyncServiceMock },
      ],
    }).compile();

    service = module.get<EmailProviderService>(EmailProviderService);
    providerRepository = module.get(getRepositoryToken(EmailProvider));
    notificationRepository = module.get(getRepositoryToken(UserNotification));
    providerRepository.count.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('auto-detects Gmail and saves provider', async () => {
    const input: EmailProviderInput = {
      autoDetect: true,
      providerType: 'CUSTOM_SMTP',
      email: 'founder@gmail.com',
      accessToken: 'access-token',
    } as EmailProviderInput;
    const created = {
      id: 'provider-1',
      type: 'GMAIL',
      email: 'founder@gmail.com',
      accessToken: 'access-token',
      userId: 'user-1',
    } as EmailProvider;

    providerRepository.findOne.mockResolvedValue(null);
    providerRepository.create.mockReturnValue(created);
    providerRepository.save.mockResolvedValue(created);

    const result = await service.configureProvider(input, 'user-1');

    expect(providerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'GMAIL',
        email: 'founder@gmail.com',
        accessToken: expect.stringMatching(/^enc:v2:/),
        workspaceId: 'workspace-1',
        userId: 'user-1',
      }),
    );
    expect(result.type).toBe('GMAIL');
  });

  it('rejects provider creation when entitlement limit is reached', async () => {
    providerRepository.count.mockResolvedValue(5);

    await expect(
      service.configureProvider(
        {
          providerType: 'CUSTOM_SMTP',
          email: 'ops@example.com',
          host: 'smtp.example.com',
          port: 587,
          password: 'secret',
        } as EmailProviderInput,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws conflict when provider already exists', async () => {
    providerRepository.findOne.mockResolvedValue({
      id: 'existing',
      email: 'founder@gmail.com',
      type: 'GMAIL',
      userId: 'user-1',
    } as any);

    await expect(
      service.configureProvider(
        {
          providerType: 'GMAIL',
          email: 'founder@gmail.com',
          accessToken: 'token',
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects SMTP provider configuration without required fields', async () => {
    providerRepository.findOne.mockResolvedValue(null);

    await expect(
      service.configureProvider(
        {
          providerType: 'CUSTOM_SMTP',
          email: 'ops@example.com',
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns provider emails for owner', async () => {
    const emails = [{ id: 'mail-1' }, { id: 'mail-2' }];
    providerRepository.findOne.mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
      emails,
    } as any);

    const result = await service.getProviderEmails('provider-1', 'user-1');

    expect(providerRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'provider-1',
        userId: 'user-1',
      },
      relations: ['emails'],
    });
    expect(result).toEqual(emails);
  });

  it('throws NotFoundException when provider cannot be deleted', async () => {
    providerRepository.findOne.mockResolvedValue(null);

    await expect(
      service.deleteProvider('missing-provider', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates credentials for SMTP provider', async () => {
    providerRepository.findOne
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        userId: 'user-1',
      } as any)
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        host: 'smtp.new-host.com',
      } as any);
    providerRepository.update.mockResolvedValue({} as any);

    await service.updateProviderCredentials(
      'provider-1',
      {
        host: 'smtp.new-host.com',
        port: 587,
        password: 'new-password',
      },
      'user-1',
    );

    expect(providerRepository.update).toHaveBeenCalledWith(
      'provider-1',
      expect.objectContaining({
        host: 'smtp.new-host.com',
        port: 587,
        password: expect.stringMatching(/^enc:v2:/),
      }),
    );
  });

  it('creates SMTP transporter with enterprise pooling config', async () => {
    await service.getTransporter({
      id: 'provider-1',
      type: 'CUSTOM_SMTP',
      email: 'ops@example.com',
      host: 'smtp.example.com',
      port: 587,
      password: 'secret',
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        pool: true,
      }),
    );
  });

  it('syncs gmail provider through gmail sync service', async () => {
    providerRepository.findOne
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'GMAIL',
        userId: 'user-1',
      } as EmailProvider)
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'GMAIL',
        userId: 'user-1',
        email: 'founder@gmail.com',
        status: 'connected',
      } as EmailProvider);
    gmailSyncServiceMock.syncGmailProvider.mockResolvedValue({ imported: 1 });

    const providerUi = await service.syncProvider('provider-1', 'user-1');

    expect(gmailSyncServiceMock.syncGmailProvider).toHaveBeenCalledWith(
      'provider-1',
      'user-1',
      25,
    );
    expect(providerUi.status).toBe('connected');
  });

  it('marks provider sync as error when smtp validation fails', async () => {
    providerRepository.findOne
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        userId: 'user-1',
      } as EmailProvider)
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        userId: 'user-1',
        email: 'ops@example.com',
        status: 'error',
        lastSyncError: 'SMTP connection failed',
      } as EmailProvider)
      .mockResolvedValueOnce({
        id: 'provider-1',
        type: 'CUSTOM_SMTP',
        userId: 'user-1',
      } as EmailProvider);
    jest.spyOn(service, 'validateProvider').mockResolvedValue({
      valid: false,
      message: 'SMTP connection failed',
    });
    providerRepository.update.mockResolvedValue({} as any);

    const providerUi = await service.syncProvider('provider-1', 'user-1');

    expect(providerRepository.update).toHaveBeenCalledWith('provider-1', {
      status: 'syncing',
      lastSyncError: null,
      lastSyncErrorAt: null,
    });
    expect(providerRepository.update).toHaveBeenCalledWith(
      'provider-1',
      expect.objectContaining({
        status: 'error',
        lastSyncError: 'SMTP connection failed',
      }),
    );
    expect(providerUi.status).toBe('error');
    expect(providerUi.lastSyncError).toBe('SMTP connection failed');
  });

  it('runs batch provider sync and aggregates success/failure counters', async () => {
    providerRepository.find.mockResolvedValue([
      {
        id: 'provider-1',
        type: 'GMAIL',
        email: 'founder@gmail.com',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
      {
        id: 'provider-2',
        type: 'OUTLOOK',
        email: 'ops@outlook.com',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      } as EmailProvider,
    ]);
    jest
      .spyOn(service, 'syncProvider')
      .mockResolvedValueOnce({
        id: 'provider-1',
        status: 'connected',
      } as any)
      .mockResolvedValueOnce({
        id: 'provider-2',
        status: 'error',
        lastSyncError: 'outlook graph unavailable',
      } as any);

    const result = await service.syncUserProviders({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    expect(providerRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(result.requestedProviders).toBe(2);
    expect(result.syncedProviders).toBe(1);
    expect(result.failedProviders).toBe(1);
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'provider-1',
          success: true,
        }),
        expect.objectContaining({
          providerId: 'provider-2',
          success: false,
          error: 'outlook graph unavailable',
        }),
      ]),
    );
  });

  it('throws when explicit provider id is not owned by user', async () => {
    providerRepository.findOne.mockResolvedValue(null);

    await expect(
      service.syncUserProviders({
        userId: 'user-1',
        providerId: 'provider-missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns provider sync stats for scoped workspace', async () => {
    providerRepository.find.mockResolvedValue([
      {
        id: 'provider-1',
        status: 'connected',
        lastSyncedAt: new Date(),
        lastSyncErrorAt: null,
      } as EmailProvider,
      {
        id: 'provider-2',
        status: 'error',
        lastSyncedAt: null,
        lastSyncErrorAt: new Date(),
      } as unknown as EmailProvider,
      {
        id: 'provider-3',
        status: 'syncing',
        lastSyncedAt: null,
        lastSyncErrorAt: null,
      } as unknown as EmailProvider,
    ]);

    const result = await service.getProviderSyncStatsForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });

    expect(providerRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        totalProviders: 3,
        connectedProviders: 1,
        syncingProviders: 1,
        errorProviders: 1,
        recentlySyncedProviders: 1,
        recentlyErroredProviders: 1,
        windowHours: 24,
      }),
    );
  });

  it('clamps provider sync stats window to minimum bound', async () => {
    providerRepository.find.mockResolvedValue([]);

    const result = await service.getProviderSyncStatsForUser({
      userId: 'user-1',
      windowHours: 0,
    });

    expect(result.windowHours).toBe(1);
  });

  it('exports provider sync data snapshot with scoped metadata', async () => {
    providerRepository.find.mockResolvedValue([
      {
        id: 'provider-1',
        type: 'GMAIL',
        email: 'founder@gmail.com',
        status: 'connected',
        isActive: true,
        workspaceId: 'workspace-1',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      } as EmailProvider,
      {
        id: 'provider-2',
        type: 'OUTLOOK',
        email: 'ops@outlook.com',
        status: 'error',
        isActive: false,
        workspaceId: 'workspace-1',
        lastSyncError: 'graph unavailable',
        lastSyncErrorAt: new Date('2026-02-16T00:10:00.000Z'),
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T00:10:00.000Z'),
      } as EmailProvider,
    ]);

    const result = await service.exportProviderSyncDataForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      limit: 9999,
    });
    const payload = JSON.parse(result.dataJson) as {
      summary: { totalProviders: number; statusCounts: Record<string, number> };
      providers: Array<{ id: string; status: string }>;
    };

    expect(providerRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
        take: 500,
      }),
    );
    expect(payload.summary.totalProviders).toBe(2);
    expect(payload.summary.statusCounts.connected).toBe(1);
    expect(payload.summary.statusCounts.error).toBe(1);
    expect(payload.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'provider-1', status: 'connected' }),
        expect.objectContaining({ id: 'provider-2', status: 'error' }),
      ]),
    );
  });

  it('returns provider sync alert delivery stats for scoped workspace', async () => {
    notificationRepository.find.mockResolvedValue([
      {
        id: 'notif-failed',
        type: 'SYNC_FAILED',
        workspaceId: 'workspace-1',
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
      } as unknown as UserNotification,
      {
        id: 'notif-recovered',
        type: 'SYNC_RECOVERED',
        workspaceId: 'workspace-1',
        createdAt: new Date('2026-02-16T01:00:00.000Z'),
      } as unknown as UserNotification,
    ]);

    const result = await service.getProviderSyncAlertDeliveryStatsForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
    });

    expect(notificationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'ASC' },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        totalAlerts: 2,
        failedAlerts: 1,
        recoveredAlerts: 1,
      }),
    );
  });

  it('returns provider sync alert delivery trend series buckets', async () => {
    const nowMs = Date.now();
    notificationRepository.find.mockResolvedValue([
      {
        id: 'notif-failed',
        type: 'SYNC_FAILED',
        createdAt: new Date(nowMs - 70 * 60 * 1000),
      } as unknown as UserNotification,
      {
        id: 'notif-recovered',
        type: 'SYNC_RECOVERED',
        createdAt: new Date(nowMs - 10 * 60 * 1000),
      } as unknown as UserNotification,
    ]);

    const result = await service.getProviderSyncAlertDeliverySeriesForUser({
      userId: 'user-1',
      windowHours: 2,
      bucketMinutes: 60,
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((point) => point.failedAlerts > 0)).toBe(true);
    expect(result.some((point) => point.recoveredAlerts > 0)).toBe(true);
  });

  it('returns provider sync alert notification history rows', async () => {
    notificationRepository.find.mockResolvedValue([
      {
        id: 'notif-failed',
        type: 'SYNC_FAILED',
        title: 'Gmail sync failed',
        message: 'failed',
        metadata: {
          providerId: 'provider-1',
          providerType: 'GMAIL',
          attempts: 2,
          error: 'rate limited',
        },
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
      } as unknown as UserNotification,
    ]);

    const rows = await service.getProviderSyncAlertsForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      limit: 10,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        notificationId: 'notif-failed',
        status: 'FAILED',
        providerId: 'provider-1',
        attempts: 2,
      }),
    ]);
  });

  it('exports provider sync alert delivery analytics payload', async () => {
    const statsSpy = jest
      .spyOn(service, 'getProviderSyncAlertDeliveryStatsForUser')
      .mockResolvedValue({
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalAlerts: 2,
        failedAlerts: 1,
        recoveredAlerts: 1,
        lastAlertAtIso: '2026-02-16T01:00:00.000Z',
      });
    const seriesSpy = jest
      .spyOn(service, 'getProviderSyncAlertDeliverySeriesForUser')
      .mockResolvedValue([
        {
          bucketStart: new Date('2026-02-16T00:00:00.000Z'),
          totalAlerts: 2,
          failedAlerts: 1,
          recoveredAlerts: 1,
        },
      ]);
    const alertsSpy = jest
      .spyOn(service, 'getProviderSyncAlertsForUser')
      .mockResolvedValue([
        {
          notificationId: 'notif-failed',
          status: 'FAILED',
          title: 'Gmail sync failed',
          message: 'failed',
          createdAt: new Date('2026-02-16T00:00:00.000Z'),
        },
      ]);

    const exported = await service.exportProviderSyncAlertDeliveryDataForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
      limit: 10,
    });
    const payload = JSON.parse(exported.dataJson) as {
      stats: { totalAlerts: number };
      series: Array<{ totalAlerts: number }>;
      alertCount: number;
    };

    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(seriesSpy).toHaveBeenCalledTimes(1);
    expect(alertsSpy).toHaveBeenCalledTimes(1);
    expect(payload.stats.totalAlerts).toBe(2);
    expect(payload.series[0]?.totalAlerts).toBe(2);
    expect(payload.alertCount).toBe(1);
  });
});
