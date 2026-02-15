/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import axios from 'axios';
import { NotificationWebhookService } from './notification-webhook.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NotificationWebhookService', () => {
  let service: NotificationWebhookService;
  const envBackup = {
    webhookUrl: process.env.MAILZEN_NOTIFICATION_WEBHOOK_URL,
    webhookToken: process.env.MAILZEN_NOTIFICATION_WEBHOOK_TOKEN,
    webhookTimeoutMs: process.env.MAILZEN_NOTIFICATION_WEBHOOK_TIMEOUT_MS,
    webhookRetries: process.env.MAILZEN_NOTIFICATION_WEBHOOK_RETRIES,
    webhookSigningKey: process.env.MAILZEN_NOTIFICATION_WEBHOOK_SIGNING_KEY,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationWebhookService();
    delete process.env.MAILZEN_NOTIFICATION_WEBHOOK_URL;
    delete process.env.MAILZEN_NOTIFICATION_WEBHOOK_TOKEN;
    delete process.env.MAILZEN_NOTIFICATION_WEBHOOK_TIMEOUT_MS;
    delete process.env.MAILZEN_NOTIFICATION_WEBHOOK_RETRIES;
    delete process.env.MAILZEN_NOTIFICATION_WEBHOOK_SIGNING_KEY;
  });

  afterEach(() => {
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_URL = envBackup.webhookUrl;
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_TOKEN = envBackup.webhookToken;
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_TIMEOUT_MS =
      envBackup.webhookTimeoutMs;
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_RETRIES = envBackup.webhookRetries;
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_SIGNING_KEY =
      envBackup.webhookSigningKey;
  });

  it('skips delivery when webhook url is not configured', async () => {
    await service.dispatchNotificationsMarkedRead({
      userId: 'user-1',
      markedCount: 2,
    });

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('sends webhook payload with auth and signature headers', async () => {
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_URL = 'https://hooks.mailzen.test';
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_TOKEN = 'token-1';
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_SIGNING_KEY = 'signing-key';
    mockedAxios.post.mockResolvedValue({} as never);

    await service.dispatchNotificationsMarkedRead({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      markedCount: 2,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.mailzen.test',
      expect.objectContaining({
        eventType: 'NOTIFICATIONS_MARKED_READ',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer token-1',
          'x-mailzen-notification-signature': expect.any(String),
        }),
      }),
    );
  });

  it('retries webhook delivery according to configured retry count', async () => {
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_URL = 'https://hooks.mailzen.test';
    process.env.MAILZEN_NOTIFICATION_WEBHOOK_RETRIES = '1';
    mockedAxios.post
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce({} as never);

    await service.dispatchNotificationsMarkedRead({
      userId: 'user-1',
      markedCount: 1,
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});
