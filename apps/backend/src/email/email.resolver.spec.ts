import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { MailService } from './mail.service';
import { EmailService } from './email.service';
import { EmailResolver } from './email.resolver';

describe('EmailResolver', () => {
  const emailService = {
    getEmailsByUser: jest.fn(),
    getEmailById: jest.fn(),
    sendEmail: jest.fn(),
    markEmailRead: jest.fn(),
  };
  const mailService = {
    sendRealEmail: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  } as unknown as Repository<User>;

  const resolver = new EmailResolver(
    emailService as unknown as EmailService,
    mailService as unknown as MailService,
    userRepo,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards authenticated user id when marking email read', async () => {
    emailService.markEmailRead.mockResolvedValue({
      id: 'email-1',
      status: 'READ',
    });

    const result = await resolver.markEmailRead(
      { emailId: 'email-1' } as never,
      {
        req: {
          user: {
            id: 'user-1',
          },
        },
      } as never,
    );

    expect(emailService.markEmailRead).toHaveBeenCalledWith('email-1', 'user-1');
    expect(result).toEqual(
      expect.objectContaining({
        id: 'email-1',
      }),
    );
  });

  it('forwards authenticated user id when sending real email', async () => {
    mailService.sendRealEmail.mockResolvedValue({
      messageId: 'msg-1',
      accepted: ['one@mailzen.com'],
      rejected: [],
    });

    const result = await resolver.sendRealEmail(
      {
        senderId: 'sender-1',
        subject: 'Hello',
        body: 'Body',
        recipientIds: ['one@mailzen.com'],
      } as never,
      {
        req: {
          user: {
            id: 'user-2',
          },
        },
      } as never,
    );

    expect(mailService.sendRealEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'sender-1',
      }),
      'user-2',
    );
    expect(result).toEqual(
      expect.objectContaining({
        messageId: 'msg-1',
      }),
    );
  });
});
