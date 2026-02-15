import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingWebhookController } from './billing-webhook.controller';

describe('BillingWebhookController', () => {
  let controller: BillingWebhookController;
  const ingestBillingWebhookMock = jest.fn();
  const originalWebhookSecret = process.env.BILLING_WEBHOOK_SHARED_SECRET;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BillingWebhookController],
      providers: [
        {
          provide: BillingService,
          useValue: {
            ingestBillingWebhook: ingestBillingWebhookMock,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(BillingWebhookController);
    ingestBillingWebhookMock.mockReset();
    delete process.env.BILLING_WEBHOOK_SHARED_SECRET;
  });

  afterAll(() => {
    if (originalWebhookSecret) {
      process.env.BILLING_WEBHOOK_SHARED_SECRET = originalWebhookSecret;
      return;
    }
    delete process.env.BILLING_WEBHOOK_SHARED_SECRET;
  });

  it('ingests billing webhook using type/id fields', async () => {
    ingestBillingWebhookMock.mockResolvedValue({
      id: 'evt-1',
      externalEventId: 'evt_external_1',
      status: 'processed',
    });

    const result = await controller.ingestWebhook(
      'stripe',
      {
        id: 'evt_external_1',
        type: 'invoice.paid',
        userId: 'user-1',
        amountCents: 1900,
      },
      undefined,
    );

    expect(ingestBillingWebhookMock).toHaveBeenCalledWith({
      provider: 'stripe',
      eventType: 'invoice.paid',
      externalEventId: 'evt_external_1',
      payloadJson: JSON.stringify({
        id: 'evt_external_1',
        type: 'invoice.paid',
        userId: 'user-1',
        amountCents: 1900,
      }),
    });
    expect(result.accepted).toBe(true);
    expect(result.eventId).toBe('evt-1');
  });

  it('rejects webhook when configured secret does not match', async () => {
    process.env.BILLING_WEBHOOK_SHARED_SECRET = 'expected-secret';

    await expect(
      controller.ingestWebhook(
        'stripe',
        {
          eventId: 'evt_external_2',
          eventType: 'invoice.payment_failed',
        },
        'wrong-secret',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ingestBillingWebhookMock).not.toHaveBeenCalled();
  });
});
