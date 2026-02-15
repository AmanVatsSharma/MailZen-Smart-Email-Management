/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { User } from '../user/entities/user.entity';
import { InboxService } from './inbox.service';

describe('InboxService', () => {
  let service: InboxService;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailboxRepo: jest.Mocked<Repository<Mailbox>>;
  let providerRepo: jest.Mocked<Repository<EmailProvider>>;

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    mailboxRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mailbox>>;
    providerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;

    service = new InboxService(userRepo, mailboxRepo, providerRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists inboxes scoped to active workspace', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
      activeInboxType: 'PROVIDER',
      activeInboxId: 'provider-1',
    } as User);
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
        status: 'ACTIVE',
      },
    ] as Mailbox[]);
    providerRepo.find.mockResolvedValue([
      {
        id: 'provider-1',
        email: 'founder@gmail.com',
        status: 'connected',
      },
    ] as EmailProvider[]);

    const result = await service.listUserInboxes('user-1');

    expect(mailboxRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(providerRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(result).toHaveLength(2);
  });

  it('scopes active provider update to active workspace', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
    } as User);
    providerRepo.findOne.mockResolvedValue({
      id: 'provider-1',
      email: 'founder@gmail.com',
      status: 'connected',
    } as EmailProvider);
    providerRepo.update.mockResolvedValue({} as any);
    userRepo.update.mockResolvedValue({} as any);
    mailboxRepo.find.mockResolvedValue([]);
    providerRepo.find.mockResolvedValue([]);

    await service.setActiveInbox('user-1', 'PROVIDER', 'provider-1');

    expect(providerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'provider-1', userId: 'user-1', workspaceId: 'workspace-1' },
    });
    expect(providerRepo.update).toHaveBeenCalledWith(
      { userId: 'user-1', workspaceId: 'workspace-1' },
      { isActive: false },
    );
  });

  it('throws when mailbox is not in active workspace', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      activeWorkspaceId: 'workspace-1',
    } as User);
    mailboxRepo.findOne.mockResolvedValue(null);

    await expect(
      service.setActiveInbox('user-1', 'MAILBOX', 'mailbox-unknown'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
