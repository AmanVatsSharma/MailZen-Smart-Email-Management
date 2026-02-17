import { MailerService } from '@nestjs-modules/mailer';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    mailerService = {
      sendMail: jest.fn(),
    } as unknown as jest.Mocked<MailerService>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    service = new MailService(mailerService, auditLogRepo);
    jest.clearAllMocks();
  });

  it('sends email and records success audit action', async () => {
    mailerService.sendMail.mockResolvedValue({
      messageId: 'msg-1',
      accepted: ['one@mailzen.com'],
      rejected: [],
    } as never);

    const result = await service.sendRealEmail(
      {
        senderId: 'sender-1',
        subject: 'Hello',
        body: 'Body',
        recipientIds: ['one@mailzen.com'],
      },
      'user-1',
    );

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'one@mailzen.com',
        subject: 'Hello',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'real_email_sent',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        messageId: 'msg-1',
      }),
    );
  });

  it('records failure audit action and rethrows send error', async () => {
    mailerService.sendMail.mockRejectedValue(new Error('smtp unavailable'));

    await expect(
      service.sendRealEmail(
        {
          senderId: 'sender-1',
          subject: 'Hello',
          body: 'Body',
          recipientIds: ['one@mailzen.com'],
        },
        'user-1',
      ),
    ).rejects.toThrow('smtp unavailable');

    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'real_email_send_failed',
      }),
    );
  });

  it('continues send flow when success audit persistence fails', async () => {
    mailerService.sendMail.mockResolvedValue({
      messageId: 'msg-2',
      accepted: ['one@mailzen.com'],
      rejected: [],
    } as never);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.sendRealEmail(
      {
        senderId: 'sender-1',
        subject: 'Hello',
        body: 'Body',
        recipientIds: ['one@mailzen.com'],
      },
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        messageId: 'msg-2',
      }),
    );
  });
});
