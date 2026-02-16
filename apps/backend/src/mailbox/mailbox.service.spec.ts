/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MailboxService } from './mailbox.service';

describe('MailboxService', () => {
  const mailboxRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };
  const mailboxInboundEventRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const notificationPreferenceRepo = {
    findOne: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const mailServer = {
    provisionMailbox: jest.fn(),
  };
  const billingService = {
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
  const workspaceService = {
    listMyWorkspaces: jest.fn().mockResolvedValue([
      {
        id: 'workspace-1',
        isPersonal: true,
      },
    ]),
  };
  const envBackup = {
    targetSuccess: process.env.MAILZEN_INBOUND_SLA_TARGET_SUCCESS_PERCENT,
    warningRejection: process.env.MAILZEN_INBOUND_SLA_WARNING_REJECTION_PERCENT,
    criticalRejection:
      process.env.MAILZEN_INBOUND_SLA_CRITICAL_REJECTION_PERCENT,
  };

  const service = new MailboxService(
    mailboxRepo as any,
    userRepo as any,
    mailboxInboundEventRepo as any,
    notificationPreferenceRepo as any,
    mailServer as any,
    billingService as any,
    workspaceService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MAILZEN_INBOUND_SLA_TARGET_SUCCESS_PERCENT;
    delete process.env.MAILZEN_INBOUND_SLA_WARNING_REJECTION_PERCENT;
    delete process.env.MAILZEN_INBOUND_SLA_CRITICAL_REJECTION_PERCENT;
    mailboxRepo.count.mockResolvedValue(0);
    mailboxRepo.delete.mockResolvedValue({ affected: 1 });
    userRepo.update.mockResolvedValue({ affected: 1 });
    notificationPreferenceRepo.findOne.mockResolvedValue(null);
    mailboxInboundEventRepo.find.mockResolvedValue([]);
    mailboxInboundEventRepo.findOne.mockResolvedValue(null);
    mailboxInboundEventRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      workspaceMemberLimit: 25,
      aiCreditsPerMonth: 500,
      mailboxStorageLimitMb: 10240,
    });
  });

  afterEach(() => {
    if (typeof envBackup.targetSuccess === 'string') {
      process.env.MAILZEN_INBOUND_SLA_TARGET_SUCCESS_PERCENT =
        envBackup.targetSuccess;
    } else {
      delete process.env.MAILZEN_INBOUND_SLA_TARGET_SUCCESS_PERCENT;
    }
    if (typeof envBackup.warningRejection === 'string') {
      process.env.MAILZEN_INBOUND_SLA_WARNING_REJECTION_PERCENT =
        envBackup.warningRejection;
    } else {
      delete process.env.MAILZEN_INBOUND_SLA_WARNING_REJECTION_PERCENT;
    }
    if (typeof envBackup.criticalRejection === 'string') {
      process.env.MAILZEN_INBOUND_SLA_CRITICAL_REJECTION_PERCENT =
        envBackup.criticalRejection;
    } else {
      delete process.env.MAILZEN_INBOUND_SLA_CRITICAL_REJECTION_PERCENT;
    }
  });

  it('rejects invalid desired local part', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.createMailbox('user-1', 'Invalid..Handle?'),
    ).rejects.toThrow(BadRequestException);
    expect(mailboxRepo.save).not.toHaveBeenCalled();
  });

  it('rejects already taken desired local part', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    mailboxRepo.findOne.mockResolvedValue({ id: 'existing-box' });

    await expect(service.createMailbox('user-1', 'sales')).rejects.toThrow(
      ConflictException,
    );
    expect(mailboxRepo.save).not.toHaveBeenCalled();
  });

  it('rejects mailbox creation when entitlement limit is reached', async () => {
    mailboxRepo.count.mockResolvedValue(5);
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });

    await expect(service.createMailbox('user-1', 'sales')).rejects.toThrow(
      BadRequestException,
    );
    expect(mailboxRepo.save).not.toHaveBeenCalled();
  });

  it('creates mailbox for available desired local part', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    mailboxRepo.findOne.mockResolvedValue(null);
    mailboxRepo.create.mockImplementation((data) => data);
    mailboxRepo.save.mockResolvedValue({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
    });
    mailServer.provisionMailbox.mockResolvedValue(undefined);

    const result = await service.createMailbox('user-1', 'sales');

    expect(mailboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        localPart: 'sales',
        domain: 'mailzen.com',
        email: 'sales@mailzen.com',
        quotaLimitMb: 10240,
      }),
    );
    expect(mailServer.provisionMailbox).toHaveBeenCalledWith(
      'user-1',
      'sales',
      10240,
    );
    expect(userRepo.update).toHaveBeenCalledWith('user-1', {
      activeInboxType: 'MAILBOX',
      activeInboxId: 'mailbox-1',
    });
    expect(result).toEqual({ id: 'mailbox-1', email: 'sales@mailzen.com' });
  });

  it('clamps mailbox quota to safe minimum when entitlement value is invalid', async () => {
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'FREE',
      providerLimit: 1,
      mailboxLimit: 1,
      workspaceLimit: 1,
      workspaceMemberLimit: 3,
      aiCreditsPerMonth: 50,
      mailboxStorageLimitMb: 0,
    });
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    mailboxRepo.findOne.mockResolvedValue(null);
    mailboxRepo.create.mockImplementation((data) => data);
    mailboxRepo.save.mockResolvedValue({
      id: 'mailbox-1',
      email: 'founder@mailzen.com',
    });
    mailServer.provisionMailbox.mockResolvedValue(undefined);

    await service.createMailbox('user-1', 'founder');

    expect(mailboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quotaLimitMb: 128,
      }),
    );
  });

  it('does not overwrite existing active inbox when creating mailbox', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeInboxType: 'PROVIDER',
      activeInboxId: 'provider-1',
    });
    mailboxRepo.findOne.mockResolvedValue(null);
    mailboxRepo.create.mockImplementation((data) => data);
    mailboxRepo.save.mockResolvedValue({
      id: 'mailbox-2',
      email: 'ops@mailzen.com',
    });
    mailServer.provisionMailbox.mockResolvedValue(undefined);

    const result = await service.createMailbox('user-1', 'ops');

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'mailbox-2', email: 'ops@mailzen.com' });
  });

  it('rolls back mailbox row when provisioning fails', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    mailboxRepo.findOne.mockResolvedValue(null);
    mailboxRepo.create.mockImplementation((data) => data);
    mailboxRepo.save.mockResolvedValue({
      id: 'mailbox-rollback-1',
      email: 'sales@mailzen.com',
    });
    mailServer.provisionMailbox.mockRejectedValue(
      new Error('external provisioning failed'),
    );

    await expect(service.createMailbox('user-1', 'sales')).rejects.toThrow(
      'external provisioning failed',
    );
    expect(mailboxRepo.delete).toHaveBeenCalledWith({
      id: 'mailbox-rollback-1',
      userId: 'user-1',
    });
  });

  it('returns mailbox inbound events with mailbox email mapping', async () => {
    mailboxInboundEventRepo.find.mockResolvedValue([
      {
        id: 'event-1',
        mailboxId: 'mailbox-1',
        messageId: '<msg-1@example.com>',
        emailId: 'email-1',
        inboundThreadKey: 'thread-1',
        status: 'ACCEPTED',
        sourceIp: '198.51.100.10',
        signatureValidated: true,
        errorReason: null,
        createdAt: new Date('2026-02-15T12:00:00.000Z'),
      },
    ]);
    mailboxRepo.find.mockResolvedValue([
      { id: 'mailbox-1', email: 'sales@mailzen.com' },
    ]);

    const events = await service.getInboundEvents('user-1', { limit: 10 });

    expect(mailboxInboundEventRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 10,
      }),
    );
    expect(events).toEqual([
      expect.objectContaining({
        id: 'event-1',
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        status: 'ACCEPTED',
      }),
    ]);
  });

  it('returns empty inbound events when scoped workspace has no mailboxes', async () => {
    mailboxRepo.find.mockResolvedValue([]);

    const events = await service.getInboundEvents('user-1', {
      workspaceId: 'workspace-empty',
    });

    expect(events).toEqual([]);
    expect(mailboxInboundEventRepo.find).not.toHaveBeenCalled();
  });

  it('rejects inbound event query with invalid status filter', async () => {
    await expect(
      service.getInboundEvents('user-1', { status: 'invalid-status' }),
    ).rejects.toThrow(BadRequestException);
    expect(mailboxInboundEventRepo.find).not.toHaveBeenCalled();
  });

  it('returns inbound event stats scoped to requested window', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: 'ACCEPTED', count: '4' },
        { status: 'DEDUPLICATED', count: '1' },
        { status: 'REJECTED', count: '2' },
      ]),
    };
    mailboxInboundEventRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    mailboxInboundEventRepo.findOne.mockResolvedValue({
      createdAt: new Date('2026-02-15T13:00:00.000Z'),
    });

    const stats = await service.getInboundEventStats('user-1', {
      windowHours: 12,
    });

    expect(mailboxInboundEventRepo.createQueryBuilder).toHaveBeenCalledWith(
      'event',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.createdAt >= :windowStart',
      expect.objectContaining({ windowStart: expect.any(String) }),
    );
    expect(stats).toEqual({
      mailboxId: null,
      mailboxEmail: null,
      windowHours: 12,
      totalCount: 7,
      acceptedCount: 4,
      deduplicatedCount: 1,
      rejectedCount: 2,
      successRatePercent: 71.43,
      rejectionRatePercent: 28.57,
      slaTargetSuccessPercent: 99,
      slaWarningRejectedPercent: 1,
      slaCriticalRejectedPercent: 5,
      slaStatus: 'CRITICAL',
      meetsSla: false,
      lastProcessedAt: new Date('2026-02-15T13:00:00.000Z'),
    });
  });

  it('returns zeroed inbound stats when workspace has no mailboxes', async () => {
    mailboxRepo.find.mockResolvedValue([]);

    const stats = await service.getInboundEventStats('user-1', {
      workspaceId: 'workspace-empty',
      windowHours: 24,
    });

    expect(stats).toEqual({
      mailboxId: null,
      mailboxEmail: null,
      windowHours: 24,
      totalCount: 0,
      acceptedCount: 0,
      deduplicatedCount: 0,
      rejectedCount: 0,
      successRatePercent: 100,
      rejectionRatePercent: 0,
      slaTargetSuccessPercent: 99,
      slaWarningRejectedPercent: 1,
      slaCriticalRejectedPercent: 5,
      slaStatus: 'NO_DATA',
      meetsSla: true,
      lastProcessedAt: null,
    });
  });

  it('applies persisted notification preference thresholds when computing inbound stats', async () => {
    notificationPreferenceRepo.findOne.mockResolvedValue({
      mailboxInboundSlaTargetSuccessPercent: 70,
      mailboxInboundSlaWarningRejectedPercent: 30,
      mailboxInboundSlaCriticalRejectedPercent: 60,
    });
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: 'ACCEPTED', count: '4' },
        { status: 'DEDUPLICATED', count: '1' },
        { status: 'REJECTED', count: '2' },
      ]),
    };
    mailboxInboundEventRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    mailboxInboundEventRepo.findOne.mockResolvedValue({
      createdAt: new Date('2026-02-15T13:00:00.000Z'),
    });

    const stats = await service.getInboundEventStats('user-1', {
      windowHours: 12,
    });

    expect(stats.slaTargetSuccessPercent).toBe(70);
    expect(stats.slaWarningRejectedPercent).toBe(30);
    expect(stats.slaCriticalRejectedPercent).toBe(60);
    expect(stats.slaStatus).toBe('HEALTHY');
    expect(stats.meetsSla).toBe(true);
  });

  it('returns mailbox inbound trend series with status bucket counts', async () => {
    const nowMs = Date.now();
    mailboxInboundEventRepo.find.mockResolvedValue([
      {
        id: 'event-1',
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        status: 'ACCEPTED',
        createdAt: new Date(nowMs - 80 * 60 * 1000),
      },
      {
        id: 'event-2',
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        status: 'DEDUPLICATED',
        createdAt: new Date(nowMs - 80 * 60 * 1000),
      },
      {
        id: 'event-3',
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        status: 'REJECTED',
        createdAt: new Date(nowMs - 20 * 60 * 1000),
      },
    ]);

    const series = await service.getInboundEventSeries('user-1', {
      windowHours: 2,
      bucketMinutes: 60,
    });

    expect(mailboxInboundEventRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        order: { createdAt: 'ASC' },
      }),
    );
    expect(series.length).toBeGreaterThanOrEqual(2);
    const rejectedBucket = series.find((point) => point.rejectedCount > 0);
    expect(rejectedBucket?.rejectedCount).toBe(1);
    const acceptedBucket = series.find((point) => point.acceptedCount > 0);
    expect(acceptedBucket?.acceptedCount).toBe(1);
    expect(acceptedBucket?.deduplicatedCount).toBe(1);
  });

  it('exports mailbox inbound observability data snapshot', async () => {
    const inboundEventsSpy = jest
      .spyOn(service, 'getInboundEvents')
      .mockResolvedValue([
        {
          id: 'event-1',
          mailboxId: 'mailbox-1',
          mailboxEmail: 'sales@mailzen.com',
          messageId: 'msg-1',
          emailId: 'email-1',
          inboundThreadKey: 'thread-1',
          status: 'ACCEPTED',
          sourceIp: '198.51.100.1',
          signatureValidated: true,
          errorReason: null,
          createdAt: new Date('2026-02-16T00:00:00.000Z'),
        },
      ]);
    const inboundStatsSpy = jest
      .spyOn(service, 'getInboundEventStats')
      .mockResolvedValue({
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        windowHours: 24,
        totalCount: 1,
        acceptedCount: 1,
        deduplicatedCount: 0,
        rejectedCount: 0,
        successRatePercent: 100,
        rejectionRatePercent: 0,
        slaTargetSuccessPercent: 99,
        slaWarningRejectedPercent: 1,
        slaCriticalRejectedPercent: 5,
        slaStatus: 'HEALTHY',
        meetsSla: true,
        lastProcessedAt: new Date('2026-02-16T00:00:00.000Z'),
      });
    const inboundSeriesSpy = jest
      .spyOn(service, 'getInboundEventSeries')
      .mockResolvedValue([
        {
          bucketStart: new Date('2026-02-16T00:00:00.000Z'),
          totalCount: 1,
          acceptedCount: 1,
          deduplicatedCount: 0,
          rejectedCount: 0,
        },
      ]);

    const result = await service.exportInboundEventData({
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      workspaceId: 'workspace-1',
      limit: 50,
      windowHours: 24,
      bucketMinutes: 60,
    });

    expect(result.generatedAtIso).toBeTruthy();
    expect(result.dataJson).toContain('"stats"');
    expect(result.dataJson).toContain('"events"');
    expect(result.dataJson).toContain('"retentionPolicy"');

    inboundEventsSpy.mockRestore();
    inboundStatsSpy.mockRestore();
    inboundSeriesSpy.mockRestore();
  });

  it('purges old mailbox inbound events by retention window', async () => {
    const deleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 7 }),
    };
    mailboxInboundEventRepo.createQueryBuilder.mockReturnValueOnce(
      deleteBuilder as any,
    );

    const result = await service.purgeInboundEventRetentionData({
      userId: 'user-1',
      retentionDays: 200,
    });

    expect(result.deletedEvents).toBe(7);
    expect(result.retentionDays).toBe(200);
    expect(deleteBuilder.andWhere).toHaveBeenCalledWith('"userId" = :userId', {
      userId: 'user-1',
    });
  });
});
