import { Test, TestingModule } from '@nestjs/testing';
import { MailboxInboundController } from './mailbox-inbound.controller';
import { MailboxInboundService } from './mailbox-inbound.service';

describe('MailboxInboundController', () => {
  let controller: MailboxInboundController;
  const ingestInboundEventMock = jest.fn();

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MailboxInboundController],
      providers: [
        {
          provide: MailboxInboundService,
          useValue: {
            ingestInboundEvent: ingestInboundEventMock,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(MailboxInboundController);
    ingestInboundEventMock.mockReset();
  });

  it('forwards token + signature headers to inbound service', async () => {
    ingestInboundEventMock.mockResolvedValue({
      accepted: true,
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      emailId: 'email-1',
      deduplicated: false,
    });

    const payload = {
      mailboxEmail: 'sales@mailzen.com',
      from: 'lead@example.com',
      subject: 'New lead',
      textBody: 'Hello',
      messageId: '<lead-1@example.com>',
    };
    const response = await controller.receiveInboundEvent(
      payload,
      'token-1',
      'signature-1',
      '1771175187910',
      undefined,
      'req-inbound-1',
      '203.0.113.10',
    );

    expect(ingestInboundEventMock).toHaveBeenCalledWith(payload, {
      inboundTokenHeader: 'token-1',
      signatureHeader: 'signature-1',
      timestampHeader: '1771175187910',
      authorizationHeader: undefined,
      requestIdHeader: 'req-inbound-1',
      sourceIp: '203.0.113.10',
    });
    expect(response.accepted).toBe(true);
  });

  it('forwards bearer authorization fallback when token header absent', async () => {
    ingestInboundEventMock.mockResolvedValue({
      accepted: true,
      mailboxId: 'mailbox-2',
      mailboxEmail: 'support@mailzen.com',
      emailId: 'email-22',
      deduplicated: true,
    });

    const payload = {
      mailboxEmail: 'support@mailzen.com',
      from: 'reply@example.com',
      subject: 'Re: Help',
      textBody: 'Thanks',
      messageId: '<reply-2@example.com>',
    };

    await controller.receiveInboundEvent(
      payload,
      undefined,
      undefined,
      undefined,
      'Bearer token-via-auth-header',
      'req-inbound-2',
      '198.51.100.5',
    );

    expect(ingestInboundEventMock).toHaveBeenCalledWith(payload, {
      inboundTokenHeader: undefined,
      signatureHeader: undefined,
      timestampHeader: undefined,
      authorizationHeader: 'Bearer token-via-auth-header',
      requestIdHeader: 'req-inbound-2',
      sourceIp: '198.51.100.5',
    });
  });
});
