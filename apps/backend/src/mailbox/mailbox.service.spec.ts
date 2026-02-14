import { BadRequestException, ConflictException } from '@nestjs/common';
import { MailboxService } from './mailbox.service';

describe('MailboxService', () => {
  const mailboxRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  };
  const mailServer = {
    provisionMailbox: jest.fn(),
  };

  const service = new MailboxService(
    mailboxRepo as any,
    userRepo as any,
    mailServer as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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
        localPart: 'sales',
        domain: 'mailzen.com',
        email: 'sales@mailzen.com',
      }),
    );
    expect(mailServer.provisionMailbox).toHaveBeenCalledWith('user-1', 'sales');
    expect(result).toEqual({ id: 'mailbox-1', email: 'sales@mailzen.com' });
  });
});
