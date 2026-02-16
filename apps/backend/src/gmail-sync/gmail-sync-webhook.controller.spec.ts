import { UnauthorizedException } from '@nestjs/common';
import { GmailSyncService } from './gmail-sync.service';
import { GmailSyncWebhookController } from './gmail-sync-webhook.controller';

describe('GmailSyncWebhookController', () => {
  const processPushNotificationMock = jest.fn();
  const gmailSyncServiceMock: jest.Mocked<
    Pick<GmailSyncService, 'processPushNotification'>
  > = {
    processPushNotification: processPushNotificationMock,
  };
  const controller = new GmailSyncWebhookController(
    gmailSyncServiceMock as unknown as GmailSyncService,
  );
  const originalTokenEnv = process.env.GMAIL_PUSH_WEBHOOK_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GMAIL_PUSH_WEBHOOK_TOKEN;
  });

  afterAll(() => {
    if (typeof originalTokenEnv === 'string') {
      process.env.GMAIL_PUSH_WEBHOOK_TOKEN = originalTokenEnv;
      return;
    }
    delete process.env.GMAIL_PUSH_WEBHOOK_TOKEN;
  });

  it('decodes gmail push payload and triggers sync processing', async () => {
    processPushNotificationMock.mockResolvedValue({
      processedProviders: 1,
      skippedProviders: 0,
    });
    const payload = Buffer.from(
      JSON.stringify({
        emailAddress: 'Founder@MailZen.com',
        historyId: '110',
      }),
      'utf8',
    ).toString('base64');

    const result = await controller.handlePushWebhook(
      {
        message: { data: payload, messageId: 'msg-1' },
      },
      undefined,
    );

    expect(result).toEqual({
      accepted: true,
      processedProviders: 1,
      skippedProviders: 0,
    });
    expect(processPushNotificationMock).toHaveBeenCalledWith({
      emailAddress: 'founder@mailzen.com',
      historyId: '110',
    });
  });

  it('rejects webhook when query token does not match', async () => {
    process.env.GMAIL_PUSH_WEBHOOK_TOKEN = 'expected-token';
    const payload = Buffer.from(
      JSON.stringify({
        emailAddress: 'founder@mailzen.com',
        historyId: '110',
      }),
      'utf8',
    ).toString('base64');

    await expect(
      controller.handlePushWebhook(
        {
          message: { data: payload },
        },
        'wrong-token',
        'request-2',
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(processPushNotificationMock).not.toHaveBeenCalled();
  });

  it('accepts webhook when query token matches expected value', async () => {
    process.env.GMAIL_PUSH_WEBHOOK_TOKEN = 'expected-token';
    processPushNotificationMock.mockResolvedValue({
      processedProviders: 2,
      skippedProviders: 1,
    });
    const payload = Buffer.from(
      JSON.stringify({
        emailAddress: 'founder@mailzen.com',
        historyId: '200',
      }),
      'utf8',
    ).toString('base64');

    const result = await controller.handlePushWebhook(
      {
        message: { data: payload },
      },
      'expected-token',
      'request-3',
    );

    expect(result.accepted).toBe(true);
    expect(processPushNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('rejects webhook when same-length token is incorrect', async () => {
    process.env.GMAIL_PUSH_WEBHOOK_TOKEN = 'secret-12345';
    const payload = Buffer.from(
      JSON.stringify({
        emailAddress: 'founder@mailzen.com',
      }),
      'utf8',
    ).toString('base64');

    await expect(
      controller.handlePushWebhook(
        {
          message: { data: payload },
        },
        'secret-12344',
        'request-4',
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(processPushNotificationMock).not.toHaveBeenCalled();
  });
});
