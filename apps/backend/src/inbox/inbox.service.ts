import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';

/**
 * InboxService - Manages unified inbox view across mailboxes and providers
 * Handles inbox switching and active inbox state
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepository: Repository<Mailbox>,
    @InjectRepository(EmailProvider)
    private readonly providerRepository: Repository<EmailProvider>,
  ) {
    console.log('[InboxService] Initialized with TypeORM repositories');
  }

  /**
   * List all inboxes (mailboxes + providers) for a user
   * @param userId - User ID
   * @returns Combined list of inbox sources
   */
  async listUserInboxes(userId: string) {
    console.log('[InboxService] Listing inboxes for user:', userId);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [mailboxes, providers] = await Promise.all([
      this.mailboxRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.providerRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const activeType = user.activeInboxType;
    const activeId = user.activeInboxId;

    const mailboxInboxes = mailboxes.map((m) => ({
      id: m.id,
      type: 'MAILBOX',
      address: m.email,
      isActive: activeType === 'MAILBOX' && activeId === m.id,
      status: m.status,
    }));

    const providerInboxes = providers.map((p) => ({
      id: p.id,
      type: 'PROVIDER',
      address: p.email,
      isActive: activeType === 'PROVIDER' && activeId === p.id,
      status: p.status || 'connected',
    }));

    console.log(
      '[InboxService] Found',
      mailboxInboxes.length,
      'mailboxes and',
      providerInboxes.length,
      'providers',
    );
    return [...mailboxInboxes, ...providerInboxes];
  }

  /**
   * Set active inbox for user (switches between mailboxes and providers)
   * @param userId - User ID
   * @param type - Inbox type (MAILBOX or PROVIDER)
   * @param id - Inbox ID
   * @returns Updated inbox list
   */
  async setActiveInbox(
    userId: string,
    type: 'MAILBOX' | 'PROVIDER',
    id: string,
  ) {
    console.log(
      '[InboxService] Setting active inbox:',
      type,
      id,
      'for user:',
      userId,
    );

    // Ownership validation + consistent "active" flags
    if (type === 'MAILBOX') {
      const mailbox = await this.mailboxRepository.findOne({
        where: { id, userId },
      });
      if (!mailbox) throw new NotFoundException('Mailbox not found');

      // Deactivate all external providers for UI consistency
      await this.providerRepository.update({ userId }, { isActive: false });
      await this.userRepository.update(userId, {
        activeInboxType: 'MAILBOX',
        activeInboxId: id,
      });

      this.logger.log(
        `Set active inbox to MAILBOX ${mailbox.email} for user=${userId}`,
      );
      return this.listUserInboxes(userId);
    }

    const provider = await this.providerRepository.findOne({
      where: { id, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    // Toggle provider active flag (single active provider)
    await this.providerRepository.update({ userId }, { isActive: false });
    await this.providerRepository.update(id, { isActive: true });
    await this.userRepository.update(userId, {
      activeInboxType: 'PROVIDER',
      activeInboxId: id,
    });

    this.logger.log(
      `Set active inbox to PROVIDER ${provider.email} for user=${userId}`,
    );
    return this.listUserInboxes(userId);
  }
}
