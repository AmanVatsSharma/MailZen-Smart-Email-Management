import { UnauthorizedException } from '@nestjs/common';
import { OutlookSyncService } from './outlook-sync.service';
import { OutlookSyncWebhookController } from './outlook-sync-webhook.controller';

describe('OutlookSyncWebhookController', () => {
  const processPushNotificationMock = jest.fn();
  const outlookSyncServiceMock: jest.Mocked<
    Pick<OutlookSyncService, 'processPushNotification'>
  > = {
    processPushNotification: processPushNotificationMock,
  };
  const controller = new OutlookSyncWebhookController(
    outlookSyncServiceMock as unknown as OutlookSyncService,
  );
  const originalTokenEnv = process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN;
  });

  afterAll(() => {
    if (typeof originalTokenEnv === 'string') {
      process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN = originalTokenEnv;
      return;
    }
    delete process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN;
  });

  it('uses providerId query parameter and dispatches push processing', async () => {
    processPushNotificationMock.mockResolvedValue({
      processedProviders: 1,
      skippedProviders: 0,
    });

    const result = await controller.handlePushWebhook(
      { value: [] },
      undefined,
      'provider-1',
    );

    expect(result).toEqual({
      accepted: true,
      processedProviders: 1,
      skippedProviders: 0,
    });
    expect(processPushNotificationMock).toHaveBeenCalledWith({
      providerId: 'provider-1',
      emailAddress: null,
    });
  });

  it('extracts email from notification events when providerId omitted', async () => {
    processPushNotificationMock.mockResolvedValue({
      processedProviders: 2,
      skippedProviders: 1,
    });

    await controller.handlePushWebhook(
      {
        value: [
          {
            resourceData: {
              userPrincipalName: 'Founder@MailZen.com',
            },
          },
        ],
      },
      undefined,
      undefined,
    );

    expect(processPushNotificationMock).toHaveBeenCalledWith({
      providerId: null,
      emailAddress: 'founder@mailzen.com',
    });
  });

  it('rejects webhook when token does not match expected value', async () => {
    process.env.OUTLOOK_PUSH_WEBHOOK_TOKEN = 'expected-token';

    await expect(
      controller.handlePushWebhook(
        {
          providerId: 'provider-1',
        },
        'bad-token',
        undefined,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(processPushNotificationMock).not.toHaveBeenCalled();
  });
});
