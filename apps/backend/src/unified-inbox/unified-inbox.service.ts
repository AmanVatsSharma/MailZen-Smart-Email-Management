import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { In, IsNull, Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { Email } from '../email/entities/email.entity';
import { EmailLabel as PersistedEmailLabel } from '../email/entities/email-label.entity';
import { EmailLabelAssignment } from '../email/entities/email-label-assignment.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { User } from '../user/entities/user.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { EmailFilterInput } from './dto/email-filter.input';
import { EmailSortInput } from './dto/email-sort.input';
import { EmailUpdateInput } from './dto/email-update.input';
import { EmailThread } from './entities/email-thread.entity';
import { EmailFolder } from './entities/email-folder.entity';
import { EmailLabel } from './entities/email-label.entity';

type ExternalMessage = {
  id: string;
  userId: string;
  providerId: string;
  externalMessageId: string;
  threadId: string | null;
  from: string | null;
  to: string[];
  subject: string | null;
  snippet: string | null;
  internalDate: Date | null;
  labels: string[];
};

type ActiveInboxSource =
  | {
      type: 'PROVIDER';
      id: string;
    }
  | {
      type: 'MAILBOX';
      id: string;
      address: string;
    };

const SYSTEM_FOLDERS: Array<{ id: string; name: string }> = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'sent', name: 'Sent' },
  { id: 'drafts', name: 'Drafts' },
  { id: 'spam', name: 'Spam' },
  { id: 'trash', name: 'Trash' },
  { id: 'archive', name: 'Archive' },
];

@Injectable()
export class UnifiedInboxService {
  private readonly logger = new Logger(UnifiedInboxService.name);
  private readonly googleOAuth2Client: OAuth2Client;

  constructor(
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    @InjectRepository(ExternalEmailMessage)
    private readonly externalEmailMessageRepo: Repository<ExternalEmailMessage>,
    @InjectRepository(ExternalEmailLabel)
    private readonly externalEmailLabelRepo: Repository<ExternalEmailLabel>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(EmailLabelAssignment)
    private readonly emailLabelAssignmentRepo: Repository<EmailLabelAssignment>,
    @InjectRepository(PersistedEmailLabel)
    private readonly emailLabelRepo: Repository<PersistedEmailLabel>,
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {
    this.googleOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_PROVIDER_REDIRECT_URI ||
        process.env.GOOGLE_REDIRECT_URI,
    );
  }

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'unified_inbox_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  private parseMailboxAddress(
    input: string | null | undefined,
  ): { name: string; email: string } | null {
    if (!input) return null;
    // Common cases:
    // - "Name <email@x.com>"
    // - "email@x.com"
    const m = input.match(/^(.*)<([^>]+)>$/);
    if (m) {
      const name = (m[1] || '').trim().replace(/^"|"$/g, '');
      const email = (m[2] || '').trim();
      return { name: name || email, email };
    }
    const trimmed = input.trim().replace(/^"|"$/g, '');
    if (!trimmed) return null;
    const email = trimmed;
    const name = trimmed.split('@')[0] || trimmed;
    return { name, email };
  }

  private escapeHtml(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private labelsToFolder(labels: string[]): string {
    if (labels.includes('TRASH')) return 'trash';
    if (labels.includes('SPAM')) return 'spam';
    if (labels.includes('SENT')) return 'sent';
    if (labels.includes('DRAFT')) return 'drafts';
    if (labels.includes('INBOX')) return 'inbox';
    return 'archive';
  }

  private isUnread(labels: string[]): boolean {
    return labels.includes('UNREAD');
  }

  private isStarred(labels: string[]): boolean {
    return labels.includes('STARRED');
  }

  private normalizeStatus(status: string | null | undefined): string {
    return String(status || '')
      .trim()
      .toUpperCase();
  }

  private normalizeEmailAddress(address: string | null | undefined): string {
    return String(address || '')
      .trim()
      .toLowerCase();
  }

  private normalizeMailboxMessageIdentifier(
    value: string | null | undefined,
  ): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private isMailboxEmailParticipant(
    email: Email,
    mailboxAddress: string,
  ): boolean {
    const normalizedMailbox = this.normalizeEmailAddress(mailboxAddress);
    if (!normalizedMailbox) return false;

    const fromEmail = this.normalizeEmailAddress(
      this.parseMailboxAddress(email.from)?.email || email.from,
    );
    if (fromEmail === normalizedMailbox) return true;

    return (email.to || []).some((recipient) => {
      const parsed = this.parseMailboxAddress(recipient);
      return (
        this.normalizeEmailAddress(parsed?.email || recipient) ===
        normalizedMailbox
      );
    });
  }

  private mailboxEmailToFolder(email: Email, mailboxAddress: string): string {
    const status = this.normalizeStatus(email.status);
    if (status === 'DRAFT') return 'drafts';
    if (status === 'TRASH') return 'trash';
    if (status === 'SPAM') return 'spam';
    if (status === 'ARCHIVED') return 'archive';

    const fromEmail = this.normalizeEmailAddress(
      this.parseMailboxAddress(email.from)?.email || email.from,
    );
    if (fromEmail === this.normalizeEmailAddress(mailboxAddress)) {
      return 'sent';
    }

    return 'inbox';
  }

  private mailboxEmailIsUnread(email: Email): boolean {
    const status = this.normalizeStatus(email.status);
    return status === 'UNREAD' || status === 'NEW';
  }

  private sanitizeContentPreview(content: string): string {
    const textOnly = content
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return textOnly.slice(0, 180);
  }

  private resolveMailboxCustomLabelIds(email: Email): string[] {
    const assignments = (
      email as unknown as { labels?: Array<{ labelId?: string }> }
    ).labels;
    if (!Array.isArray(assignments)) return [];
    const ids = assignments
      .map((assignment) => String(assignment.labelId || '').trim())
      .filter(Boolean);
    return Array.from(new Set(ids));
  }

  private async listMailboxEmailsForUser(input: {
    userId: string;
    mailboxId: string;
    mailboxAddress: string;
  }): Promise<Email[]> {
    const emails = await this.emailRepo.find({
      where: [
        {
          userId: input.userId,
          mailboxId: input.mailboxId,
        },
        {
          userId: input.userId,
          mailboxId: IsNull(),
          providerId: IsNull(),
        },
      ] as any,
      order: { createdAt: 'DESC' },
      relations: ['labels'],
    });
    return emails.filter((email) => {
      if (email.mailboxId) {
        return email.mailboxId === input.mailboxId;
      }
      if (email.providerId) return false;
      return this.isMailboxEmailParticipant(email, input.mailboxAddress);
    });
  }

  private async findScopedProviderById(
    userId: string,
    providerId: string,
    activeWorkspaceId?: string | null,
  ): Promise<EmailProvider | null> {
    if (activeWorkspaceId) {
      const scopedProvider = await this.emailProviderRepo.findOne({
        where: { id: providerId, userId, workspaceId: activeWorkspaceId },
      });
      if (scopedProvider) return scopedProvider;
      return this.emailProviderRepo.findOne({
        where: { id: providerId, userId, workspaceId: null as any },
      });
    }
    return this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
  }

  private async findScopedMailboxById(
    userId: string,
    mailboxId: string,
    activeWorkspaceId?: string | null,
  ): Promise<Mailbox | null> {
    if (activeWorkspaceId) {
      const scopedMailbox = await this.mailboxRepo.findOne({
        where: { id: mailboxId, userId, workspaceId: activeWorkspaceId },
      });
      if (scopedMailbox) return scopedMailbox;
      return this.mailboxRepo.findOne({
        where: { id: mailboxId, userId, workspaceId: null as any },
      });
    }
    return this.mailboxRepo.findOne({
      where: { id: mailboxId, userId },
    });
  }

  private async findScopedPreferredProvider(input: {
    userId: string;
    activeWorkspaceId?: string | null;
    isActive?: boolean;
  }): Promise<EmailProvider | null> {
    if (input.activeWorkspaceId) {
      const scopedProvider = await this.emailProviderRepo.findOne({
        where: {
          userId: input.userId,
          workspaceId: input.activeWorkspaceId,
          ...(typeof input.isActive === 'boolean'
            ? { isActive: input.isActive }
            : {}),
        },
        order: { createdAt: 'DESC' },
      });
      if (scopedProvider) return scopedProvider;
      return this.emailProviderRepo.findOne({
        where: {
          userId: input.userId,
          workspaceId: null as any,
          ...(typeof input.isActive === 'boolean'
            ? { isActive: input.isActive }
            : {}),
        },
        order: { createdAt: 'DESC' },
      });
    }

    return this.emailProviderRepo.findOne({
      where: {
        userId: input.userId,
        ...(typeof input.isActive === 'boolean'
          ? { isActive: input.isActive }
          : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async findScopedNewestMailbox(
    userId: string,
    activeWorkspaceId?: string | null,
  ): Promise<Mailbox | null> {
    if (activeWorkspaceId) {
      const scopedMailbox = await this.mailboxRepo.findOne({
        where: { userId, workspaceId: activeWorkspaceId },
        order: { createdAt: 'DESC' },
      });
      if (scopedMailbox) return scopedMailbox;
      return this.mailboxRepo.findOne({
        where: { userId, workspaceId: null as any },
        order: { createdAt: 'DESC' },
      });
    }
    return this.mailboxRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private resolveMailboxThreadKey(email: Email): string {
    const inboundThreadKey = String(
      (email as any).inboundThreadKey || '',
    ).trim();
    if (inboundThreadKey) return inboundThreadKey;
    return email.id;
  }

  private mapMailboxEmailToThreadMessage(
    email: Email,
    source: { id: string; address: string },
    threadId: string,
  ): EmailThread['messages'][number] {
    const from = this.parseMailboxAddress(email.from) || {
      name: 'Unknown',
      email: 'unknown',
    };
    const to = (email.to || [])
      .map((entry) => this.parseMailboxAddress(entry))
      .filter(Boolean) as Array<{ name: string; email: string }>;

    const subject = email.subject || '(no subject)';
    const date = (
      email.createdAt ||
      email.updatedAt ||
      new Date()
    ).toISOString();
    const folder = this.mailboxEmailToFolder(email, source.address);
    const isUnread = this.mailboxEmailIsUnread(email);
    const isStarred = !!email.isImportant;
    const content = email.body || '';
    const contentPreview = this.sanitizeContentPreview(email.body || '');
    const labelIds = this.resolveMailboxCustomLabelIds(email);

    return {
      id: email.id,
      threadId,
      subject,
      from: { name: from.name, email: from.email },
      to: to.map((participant) => ({
        name: participant.name,
        email: participant.email,
      })),
      content,
      contentPreview,
      date,
      folder,
      isStarred,
      importance: email.isImportant ? 'high' : 'normal',
      attachments: [],
      status: isUnread ? 'unread' : 'read',
      labelIds,
      providerId: source.id,
      providerEmailId: String((email as any).inboundMessageId || email.id),
    };
  }

  private mapMailboxEmailGroupToThreadSummary(
    emails: Email[],
    source: { id: string; address: string },
  ): EmailThread {
    const sortedEmails = emails
      .slice()
      .sort(
        (left, right) =>
          new Date(left.createdAt || left.updatedAt || new Date()).getTime() -
          new Date(right.createdAt || right.updatedAt || new Date()).getTime(),
      );
    const latestEmail = sortedEmails[sortedEmails.length - 1] || emails[0];
    const threadId = this.resolveMailboxThreadKey(latestEmail);
    const messages = sortedEmails.map((email) =>
      this.mapMailboxEmailToThreadMessage(email, source, threadId),
    );
    const latestMessage = messages[messages.length - 1];

    const participants = messages.reduce(
      (acc, participant) => {
        const addParticipant = (candidate: { name: string; email: string }) => {
          if (
            !acc.find(
              (existing) =>
                existing.email.toLowerCase() === candidate.email.toLowerCase(),
            )
          ) {
            acc.push(candidate);
          }
        };
        addParticipant(participant.from);
        for (const recipient of participant.to || []) {
          addParticipant(recipient);
        }
        return acc;
      },
      [] as Array<{ name: string; email: string }>,
    );

    const labelIds = Array.from(
      new Set(messages.flatMap((message) => message.labelIds || [])),
    );
    const isUnread = sortedEmails.some((email) =>
      this.mailboxEmailIsUnread(email),
    );
    const folder = this.mailboxEmailToFolder(latestEmail, source.address);
    const subject =
      latestMessage?.subject || latestEmail.subject || '(no subject)';
    const lastMessageDate =
      latestMessage?.date ||
      (
        latestEmail.createdAt ||
        latestEmail.updatedAt ||
        new Date()
      ).toISOString();

    return {
      id: threadId,
      providerThreadId: undefined,
      subject,
      participants: participants.map((participant) => ({
        name: participant.name,
        email: participant.email,
      })),
      lastMessageDate,
      isUnread,
      folder,
      labelIds,
      providerId: source.id,
      messages,
    };
  }

  private async assertMailboxLabelOwnership(
    userId: string,
    labelIds: string[],
  ): Promise<void> {
    const normalizedLabelIds = Array.from(
      new Set(
        labelIds.map((labelId) => String(labelId || '').trim()).filter(Boolean),
      ),
    );
    if (!normalizedLabelIds.length) return;
    const labels = await this.emailLabelRepo.find({
      where: {
        userId,
        id: In(normalizedLabelIds),
      },
      select: { id: true } as any,
    });
    if (labels.length !== normalizedLabelIds.length) {
      throw new BadRequestException('One or more labels are invalid');
    }
  }

  private mapMailboxEmailToThreadSummary(
    email: Email,
    source: { id: string; address: string },
  ): EmailThread {
    return this.mapMailboxEmailGroupToThreadSummary([email], source);
  }

  private async resolveActiveInboxSource(
    userId: string,
    requestedProviderId?: string,
  ): Promise<ActiveInboxSource | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const activeWorkspaceId = (user as any)?.activeWorkspaceId as
      | string
      | null
      | undefined;

    if (requestedProviderId) {
      const p = await this.findScopedProviderById(
        userId,
        requestedProviderId,
        activeWorkspaceId,
      );
      if (!p) throw new NotFoundException('Provider not found');
      return { type: 'PROVIDER', id: p.id };
    }

    const activeType = (user as any)?.activeInboxType as string | null;
    const activeId = (user as any)?.activeInboxId as string | null;
    if (activeType === 'PROVIDER' && activeId) {
      const p = await this.findScopedProviderById(
        userId,
        activeId,
        activeWorkspaceId,
      );
      if (p) return { type: 'PROVIDER', id: p.id };
    }

    if (activeType === 'MAILBOX' && activeId) {
      const mailbox = await this.findScopedMailboxById(
        userId,
        activeId,
        activeWorkspaceId,
      );
      if (mailbox)
        return { type: 'MAILBOX', id: mailbox.id, address: mailbox.email };
    }

    // Fallback priority:
    // 1) active provider
    // 2) newest provider
    // 3) newest mailbox
    const activeProvider = await this.findScopedPreferredProvider({
      userId,
      activeWorkspaceId,
      isActive: true,
    });
    if (activeProvider) return { type: 'PROVIDER', id: activeProvider.id };
    const newestProvider = await this.findScopedPreferredProvider({
      userId,
      activeWorkspaceId,
    });
    if (newestProvider) return { type: 'PROVIDER', id: newestProvider.id };

    const newestMailbox = await this.findScopedNewestMailbox(
      userId,
      activeWorkspaceId,
    );
    if (newestMailbox)
      return {
        type: 'MAILBOX',
        id: newestMailbox.id,
        address: newestMailbox.email,
      };

    return null;
  }

  async listThreads(
    userId: string,
    limit = 10,
    offset = 0,
    filter?: EmailFilterInput | null,
    sort?: EmailSortInput | null,
  ): Promise<EmailThread[]> {
    const source = await this.resolveActiveInboxSource(
      userId,
      filter?.providerId,
    );
    if (!source) return [];

    if (source.type === 'MAILBOX') {
      const mailboxEmails = await this.listMailboxEmailsForUser({
        userId,
        mailboxId: source.id,
        mailboxAddress: source.address,
      });
      const mailboxThreadBuckets = new Map<string, Email[]>();
      for (const mailboxEmail of mailboxEmails) {
        const threadKey = this.resolveMailboxThreadKey(mailboxEmail);
        const bucket = mailboxThreadBuckets.get(threadKey) || [];
        bucket.push(mailboxEmail);
        mailboxThreadBuckets.set(threadKey, bucket);
      }

      let mailboxThreads = Array.from(mailboxThreadBuckets.values()).map(
        (threadEmails) =>
          this.mapMailboxEmailGroupToThreadSummary(threadEmails, source),
      );

      const search = filter?.search?.trim().toLowerCase();
      if (search) {
        mailboxThreads = mailboxThreads.filter((thread) => {
          const message = thread.messages[thread.messages.length - 1];
          const haystack = [
            thread.subject,
            message?.contentPreview || '',
            message?.from?.email || '',
            ...(message?.to || []).map((recipient) => recipient.email),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(search);
        });
      }

      if (filter?.status) {
        mailboxThreads = mailboxThreads.filter((thread) =>
          filter.status === 'unread' ? thread.isUnread : !thread.isUnread,
        );
      }

      if (typeof filter?.isStarred === 'boolean') {
        mailboxThreads = mailboxThreads.filter((thread) => {
          const latest = thread.messages[thread.messages.length - 1];
          return !!latest?.isStarred === filter.isStarred;
        });
      }

      if (filter?.folder) {
        const normalizedFolder = filter.folder.toLowerCase();
        mailboxThreads = mailboxThreads.filter(
          (thread) => thread.folder.toLowerCase() === normalizedFolder,
        );
      }

      if (filter?.labelIds?.length) {
        mailboxThreads = mailboxThreads.filter((thread) =>
          filter.labelIds!.every((labelId) =>
            (thread.labelIds || []).includes(labelId),
          ),
        );
      }

      if (sort?.field === 'from') {
        mailboxThreads.sort((left, right) =>
          (
            left.messages[left.messages.length - 1]?.from?.email || ''
          ).localeCompare(
            right.messages[right.messages.length - 1]?.from?.email || '',
          ),
        );
      } else if (sort?.field === 'subject') {
        mailboxThreads.sort((left, right) =>
          left.subject.localeCompare(right.subject),
        );
      } else {
        mailboxThreads.sort(
          (left, right) =>
            new Date(right.lastMessageDate).getTime() -
            new Date(left.lastMessageDate).getTime(),
        );
      }

      if (sort?.direction?.toUpperCase() === 'ASC') {
        mailboxThreads = mailboxThreads.reverse();
      }

      const pagedMailboxThreads = mailboxThreads.slice(offset, offset + limit);
      this.logger.log(
        serializeStructuredLog({
          event: 'unified_inbox_emails_list_mailbox_completed',
          userId,
          mailboxId: source.id,
          limit,
          offset,
          returnedCount: pagedMailboxThreads.length,
        }),
      );
      return pagedMailboxThreads;
    }

    const providerId = source.id;

    const qb = this.externalEmailMessageRepo
      .createQueryBuilder('m')
      .where('m.userId = :userId', { userId })
      .andWhere('m.providerId = :providerId', { providerId });

    const search = filter?.search?.trim();
    if (search) {
      qb.andWhere(
        '(m.subject ILIKE :q OR m."from" ILIKE :q OR m.snippet ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    // Label AND filter: require all specified labelIds.
    if (filter?.labelIds?.length) {
      filter.labelIds.forEach((label, idx) => {
        qb.andWhere(`:l${idx} = ANY(m.labels)`, { [`l${idx}`]: label });
      });
    }

    if (filter?.status) {
      if (filter.status === 'unread') qb.andWhere(`'UNREAD' = ANY(m.labels)`);
      else qb.andWhere(`NOT ('UNREAD' = ANY(m.labels))`);
    }

    if (typeof filter?.isStarred === 'boolean') {
      if (filter.isStarred) qb.andWhere(`'STARRED' = ANY(m.labels)`);
      else qb.andWhere(`NOT ('STARRED' = ANY(m.labels))`);
    }

    // Folder filtering via Gmail system labels.
    if (filter?.folder) {
      const f = filter.folder.toLowerCase();
      if (f === 'inbox') qb.andWhere(`'INBOX' = ANY(m.labels)`);
      else if (f === 'sent') qb.andWhere(`'SENT' = ANY(m.labels)`);
      else if (f === 'trash') qb.andWhere(`'TRASH' = ANY(m.labels)`);
      else if (f === 'spam') qb.andWhere(`'SPAM' = ANY(m.labels)`);
      else if (f === 'archive') {
        qb.andWhere(`NOT ('INBOX' = ANY(m.labels))`)
          .andWhere(`NOT ('TRASH' = ANY(m.labels))`)
          .andWhere(`NOT ('SPAM' = ANY(m.labels))`);
      } else {
        qb.andWhere(`:folderLabel = ANY(m.labels)`, {
          folderLabel: f.toUpperCase(),
        });
      }
    }

    if (sort?.field === 'from')
      qb.orderBy(
        'm."from"',
        sort.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      );
    else if (sort?.field === 'subject')
      qb.orderBy(
        'm.subject',
        sort.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      );
    else
      qb.orderBy(
        'm.internalDate',
        sort?.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      );
    qb.addOrderBy('m.createdAt', 'DESC');

    qb.select([
      'm.id',
      'm.userId',
      'm.providerId',
      'm.externalMessageId',
      'm.threadId',
      'm.from',
      'm.to',
      'm.subject',
      'm.snippet',
      'm.internalDate',
      'm.labels',
      'm.createdAt',
    ]);

    qb.skip(offset).take(limit);

    const page = await qb.getMany();

    this.logger.log(
      serializeStructuredLog({
        event: 'unified_inbox_emails_list_provider_completed',
        userId,
        providerId,
        limit,
        offset,
        returnedCount: page.length,
      }),
    );

    return page.map((m) => this.mapExternalMessageToThreadSummary(m as any));
  }

  private mapExternalMessageToThreadSummary(m: ExternalMessage): EmailThread {
    const from = this.parseMailboxAddress(m.from) || {
      name: 'Unknown',
      email: 'unknown',
    };
    const to = (m.to || [])
      .map((x) => this.parseMailboxAddress(x))
      .filter(Boolean) as Array<{ name: string; email: string }>;
    const subject = m.subject || '(no subject)';
    const date = (m.internalDate || new Date()).toISOString();
    const labels = m.labels || [];
    const folder = this.labelsToFolder(labels);
    const isUnread = this.isUnread(labels);
    const isStarred = this.isStarred(labels);
    const contentPreview = m.snippet || '';
    const content = `<p>${this.escapeHtml(contentPreview)}</p>`;
    const threadId = m.threadId || m.externalMessageId;

    const participants = [from, ...to].reduce(
      (acc, p) => {
        if (!acc.find((x) => x.email.toLowerCase() === p.email.toLowerCase()))
          acc.push(p);
        return acc;
      },
      [] as Array<{ name: string; email: string }>,
    );

    return {
      id: threadId,
      providerThreadId: m.threadId || undefined,
      subject,
      participants: participants.map((p) => ({ name: p.name, email: p.email })),
      lastMessageDate: date,
      isUnread,
      folder,
      labelIds: labels,
      providerId: m.providerId,
      messages: [
        {
          id: m.id,
          threadId,
          subject,
          from: { name: from.name, email: from.email },
          to: to.map((p) => ({ name: p.name, email: p.email })),
          content,
          contentPreview,
          date,
          folder,
          isStarred,
          importance: 'normal',
          attachments: [],
          status: isUnread ? 'unread' : 'read',
          labelIds: labels,
          providerId: m.providerId,
          providerEmailId: m.externalMessageId,
        },
      ],
    };
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private shouldRetryGmailStatus(status?: number): boolean {
    if (!status) return false;
    return (
      status === 429 ||
      status === 503 ||
      status === 500 ||
      status === 502 ||
      status === 504
    );
  }

  private async gmailRequest<T>(
    config: AxiosRequestConfig,
    meta: { userId: string; providerId: string; op: string },
  ): Promise<T> {
    const maxAttempts = 5;
    let attempt = 0;
    // base backoff ms; we add jitter and cap
    let backoff = 250;

    while (true) {
      attempt += 1;
      try {
        const res = await axios.request<T>(config);
        return res.data;
      } catch (e: any) {
        const err = e as AxiosError;
        const status = err.response?.status;
        const message = (err as any)?.message || String(err);
        const retriable = this.shouldRetryGmailStatus(status);

        this.logger.warn(
          serializeStructuredLog({
            event: 'unified_inbox_gmail_api_retry',
            operation: meta.op,
            userId: meta.userId,
            providerId: meta.providerId,
            attempt,
            maxAttempts,
            statusCode: status ?? null,
            error: message,
          }),
        );

        if (!retriable || attempt >= maxAttempts) {
          this.logger.error(
            serializeStructuredLog({
              event: 'unified_inbox_gmail_api_failed',
              operation: meta.op,
              userId: meta.userId,
              providerId: meta.providerId,
              statusCode: status ?? null,
              error: message,
            }),
          );
          throw new InternalServerErrorException('Gmail API request failed');
        }

        const jitter = Math.floor(Math.random() * 100);
        await this.sleep(Math.min(4000, backoff) + jitter);
        backoff *= 2;
      }
    }
  }

  private decodeBase64Url(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  private extractBodyHtml(payload: any): string {
    if (!payload) return '';

    // Gmail message payload is a tree of parts; prefer text/html, fallback to text/plain.
    const walk = (part: any, acc: { html?: string; text?: string }) => {
      if (!part) return;
      const mimeType = part.mimeType;
      const bodyData = part.body?.data;
      if (mimeType === 'text/html' && bodyData && !acc.html)
        acc.html = this.decodeBase64Url(bodyData);
      if (mimeType === 'text/plain' && bodyData && !acc.text)
        acc.text = this.decodeBase64Url(bodyData);
      const parts = part.parts || [];
      for (const p of parts) walk(p, acc);
    };

    const acc: { html?: string; text?: string } = {};
    walk(payload, acc);
    if (acc.html) return acc.html;
    if (acc.text) return `<pre>${this.escapeHtml(acc.text)}</pre>`;
    return '';
  }

  private parseAddressList(
    input: string | null | undefined,
  ): Array<{ name: string; email: string }> {
    if (!input) return [];
    // MVP split; good enough for most cases.
    return input
      .split(',')
      .map((s) => this.parseMailboxAddress(s))
      .filter(Boolean) as Array<{ name: string; email: string }>;
  }

  private extractAttachments(
    payload: any,
    messageId: string,
  ): Array<{ id: string; name: string; type: string; size: number }> {
    const out: Array<{ id: string; name: string; type: string; size: number }> =
      [];
    const walk = (part: any) => {
      if (!part) return;
      const filename = part.filename;
      const mimeType = part.mimeType;
      const attachmentId = part.body?.attachmentId;
      const size = Number(part.body?.size || 0);
      if (filename && attachmentId) {
        out.push({
          id: `${messageId}:${attachmentId}`,
          name: filename,
          type: mimeType || 'application/octet-stream',
          size,
        });
      }
      for (const p of part.parts || []) walk(p);
    };
    walk(payload);
    return out;
  }

  private async ensureFreshGmailAccessToken(provider: any): Promise<string> {
    if (!provider.refreshToken && !provider.accessToken) {
      throw new BadRequestException(
        'Missing OAuth credentials for Gmail provider',
      );
    }
    if (!provider.tokenExpiry || !provider.refreshToken) {
      return provider.accessToken;
    }

    const now = Date.now();
    const expiry = new Date(provider.tokenExpiry).getTime();
    if (expiry > now + 5 * 60 * 1000) {
      return provider.accessToken;
    }

    try {
      this.googleOAuth2Client.setCredentials({
        refresh_token: provider.refreshToken,
      });
      const { credentials } =
        await this.googleOAuth2Client.refreshAccessToken();
      if (!credentials.access_token)
        throw new Error('Google refresh did not return access_token');

      await this.emailProviderRepo.update(
        { id: provider.id },
        {
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
        },
      );
      return credentials.access_token;
    } catch (e: any) {
      this.logger.error(
        serializeStructuredLog({
          event: 'unified_inbox_gmail_access_token_refresh_failed',
          providerId: provider.id,
          userId: provider.userId,
          error: String(e?.message || e),
        }),
        e?.stack,
      );
      throw new InternalServerErrorException(
        'Failed to refresh Gmail access token',
      );
    }
  }

  private async getGmailProviderOrThrow(userId: string, providerId: string) {
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'GMAIL')
      throw new BadRequestException('Provider is not Gmail');
    return provider;
  }

  async getThread(userId: string, threadId: string): Promise<EmailThread> {
    const source = await this.resolveActiveInboxSource(userId);
    if (!source) throw new NotFoundException('No inbox sources connected');

    if (source.type === 'MAILBOX') {
      const mailboxEmails = await this.listMailboxEmailsForUser({
        userId,
        mailboxId: source.id,
        mailboxAddress: source.address,
      });
      const normalizedThreadIdentifier =
        this.normalizeMailboxMessageIdentifier(threadId);
      const anchorEmail = mailboxEmails.find((email) => {
        const threadKey = this.resolveMailboxThreadKey(email);
        const inboundMessageId = this.normalizeMailboxMessageIdentifier(
          (email as any).inboundMessageId,
        );
        return (
          this.normalizeMailboxMessageIdentifier(email.id) ===
            normalizedThreadIdentifier ||
          this.normalizeMailboxMessageIdentifier(threadKey) ===
            normalizedThreadIdentifier ||
          inboundMessageId === normalizedThreadIdentifier
        );
      });
      if (!anchorEmail) {
        throw new NotFoundException('Email not found');
      }
      const anchorThreadKey = this.resolveMailboxThreadKey(anchorEmail);
      const threadEmails = mailboxEmails.filter(
        (email) => this.resolveMailboxThreadKey(email) === anchorThreadKey,
      );
      return this.mapMailboxEmailGroupToThreadSummary(threadEmails, source);
    }

    const providerId = source.id;

    const anchor = await this.externalEmailMessageRepo
      .createQueryBuilder('m')
      .where('m.userId = :userId', { userId })
      .andWhere('m.providerId = :providerId', { providerId })
      .andWhere('(m.threadId = :threadId OR m.externalMessageId = :threadId)', {
        threadId,
      })
      .orderBy('m.internalDate', 'DESC')
      .addOrderBy('m.createdAt', 'DESC')
      .getOne();
    if (!anchor) throw new NotFoundException('Email not found');

    const isThread = !!anchor.threadId;
    const msgs = await this.externalEmailMessageRepo.find({
      where: isThread
        ? { userId, providerId, threadId: anchor.threadId as any }
        : { userId, providerId, externalMessageId: anchor.externalMessageId },
      order: { internalDate: 'ASC', createdAt: 'ASC' },
    });

    // If Gmail, lazily hydrate full payloads for detail rendering.
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    const isGmail = provider?.type === 'GMAIL';
    let accessToken: string | null = null;
    if (isGmail && provider)
      accessToken = await this.ensureFreshGmailAccessToken(provider);

    const mappedMessages: any[] = [];
    for (const m of msgs) {
      let raw: any = m.rawPayload;
      const hasBody =
        !!raw?.payload?.body?.data || Array.isArray(raw?.payload?.parts);
      if (isGmail && accessToken && !hasBody) {
        // Basic rate limiting: small delay between message fetches.
        await this.sleep(75);
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.externalMessageId)}`;
        const full = await this.gmailRequest<any>(
          {
            method: 'GET',
            url,
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { format: 'full' },
          },
          { userId, providerId, op: 'messages.get(full)' },
        );
        raw = full;
        await this.externalEmailMessageRepo.update(
          { id: m.id },
          {
            rawPayload: full,
            snippet: full.snippet || m.snippet || undefined,
          },
        );
      }

      const headers = raw?.payload?.headers || [];
      const get = (name: string) =>
        headers.find(
          (h: any) => String(h.name).toLowerCase() === name.toLowerCase(),
        )?.value;
      const fromStr = get('From') || m.from || '';
      const toStr = get('To') || (m.to || []).join(', ');
      const ccStr = get('Cc') || '';
      const bccStr = get('Bcc') || '';
      const subject = get('Subject') || m.subject || '(no subject)';
      const dateIso = m.internalDate
        ? m.internalDate.toISOString()
        : new Date().toISOString();
      const labels = m.labels || [];

      const from = this.parseMailboxAddress(fromStr) || {
        name: 'Unknown',
        email: 'unknown',
      };
      const to = this.parseAddressList(toStr);
      const cc = this.parseAddressList(ccStr);
      const bcc = this.parseAddressList(bccStr);
      const content =
        this.extractBodyHtml(raw?.payload) ||
        `<p>${this.escapeHtml(m.snippet || '')}</p>`;
      const contentPreview = m.snippet || '';
      const folder = this.labelsToFolder(labels);

      const attachments = this.extractAttachments(
        raw?.payload,
        m.externalMessageId,
      ).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
      }));

      mappedMessages.push({
        id: m.id,
        threadId: m.threadId || m.externalMessageId,
        subject,
        from: { name: from.name, email: from.email },
        to: to.map((p) => ({ name: p.name, email: p.email })),
        cc: cc.length
          ? cc.map((p) => ({ name: p.name, email: p.email }))
          : undefined,
        bcc: bcc.length
          ? bcc.map((p) => ({ name: p.name, email: p.email }))
          : undefined,
        content,
        contentPreview,
        date: dateIso,
        folder,
        isStarred: this.isStarred(labels),
        importance: 'normal',
        attachments,
        status: this.isUnread(labels) ? 'unread' : 'read',
        labelIds: labels,
        providerId: m.providerId,
        providerEmailId: m.externalMessageId,
      });
    }

    // Thread-level fields derived from last message.
    const last = mappedMessages[mappedMessages.length - 1];
    const participants = new Map<string, { name: string; email: string }>();
    for (const msg of mappedMessages) {
      participants.set(msg.from.email.toLowerCase(), {
        name: msg.from.name,
        email: msg.from.email,
      });
      for (const p of msg.to || [])
        participants.set(p.email.toLowerCase(), {
          name: p.name,
          email: p.email,
        });
    }

    const threadKey = anchor.threadId || anchor.externalMessageId;
    const threadLabels = anchor.labels || [];
    return {
      id: threadKey,
      providerThreadId: anchor.threadId || undefined,
      subject: last?.subject || anchor.subject || '(no subject)',
      participants: Array.from(participants.values()).map((p) => ({
        name: p.name,
        email: p.email,
      })),
      lastMessageDate:
        last?.date ||
        (anchor.internalDate
          ? anchor.internalDate.toISOString()
          : new Date().toISOString()),
      isUnread: mappedMessages.some(
        (x) => x.status === 'unread' && x.folder === 'inbox',
      ),
      messages: mappedMessages,
      folder: this.labelsToFolder(threadLabels),
      labelIds: threadLabels,
      providerId: anchor.providerId,
    };
  }

  async updateThread(
    userId: string,
    threadId: string,
    input: EmailUpdateInput,
  ): Promise<EmailThread> {
    const requestedFolder = input.folder
      ? String(input.folder).trim().toLowerCase()
      : null;
    const requestedAddLabelIds = Array.from(
      new Set(
        (input.addLabelIds || []).map((labelId) => String(labelId).trim()),
      ),
    ).filter(Boolean);
    const requestedRemoveLabelIds = Array.from(
      new Set(
        (input.removeLabelIds || []).map((labelId) => String(labelId).trim()),
      ),
    ).filter(Boolean);
    const auditBaseMetadata = {
      requestedThreadId: threadId,
      read: typeof input.read === 'boolean' ? input.read : null,
      starred: typeof input.starred === 'boolean' ? input.starred : null,
      folder: requestedFolder,
      addLabelIds: requestedAddLabelIds,
      removeLabelIds: requestedRemoveLabelIds,
    };
    const source = await this.resolveActiveInboxSource(userId);
    if (!source) throw new NotFoundException('No inbox sources connected');

    if (source.type === 'MAILBOX') {
      const mailboxEmails = await this.listMailboxEmailsForUser({
        userId,
        mailboxId: source.id,
        mailboxAddress: source.address,
      });
      const normalizedThreadIdentifier =
        this.normalizeMailboxMessageIdentifier(threadId);
      const anchorEmail = mailboxEmails.find((email) => {
        const threadKey = this.resolveMailboxThreadKey(email);
        const inboundMessageId = this.normalizeMailboxMessageIdentifier(
          (email as any).inboundMessageId,
        );
        return (
          this.normalizeMailboxMessageIdentifier(email.id) ===
            normalizedThreadIdentifier ||
          this.normalizeMailboxMessageIdentifier(threadKey) ===
            normalizedThreadIdentifier ||
          inboundMessageId === normalizedThreadIdentifier
        );
      });
      if (!anchorEmail) throw new NotFoundException('Email not found');
      const anchorThreadKey = this.resolveMailboxThreadKey(anchorEmail);
      const targetMailboxEmails = mailboxEmails.filter(
        (email) => this.resolveMailboxThreadKey(email) === anchorThreadKey,
      );
      if (!targetMailboxEmails.length)
        throw new NotFoundException('Email not found');

      const updates: Partial<Email> = {};
      if (typeof input.read === 'boolean') {
        updates.status = input.read ? 'READ' : 'UNREAD';
      }
      if (typeof input.starred === 'boolean') {
        updates.isImportant = input.starred;
      }
      if (input.folder) {
        const folder = input.folder.toLowerCase();
        if (folder === 'trash') updates.status = 'TRASH';
        else if (folder === 'spam') updates.status = 'SPAM';
        else if (folder === 'archive') updates.status = 'ARCHIVED';
        else if (folder === 'drafts') updates.status = 'DRAFT';
        else if (folder === 'sent') updates.status = 'SENT';
        else if (folder === 'inbox') updates.status = 'READ';
      }

      const addLabels = requestedAddLabelIds;
      const removeLabels = requestedRemoveLabelIds;
      await this.assertMailboxLabelOwnership(userId, [
        ...addLabels,
        ...removeLabels,
      ]);

      if (Object.keys(updates).length > 0) {
        for (const mailboxEmail of targetMailboxEmails) {
          if (Object.keys(updates).length === 0) continue;
          await this.emailRepo.update({ id: mailboxEmail.id, userId }, updates);
        }
      }

      const targetMailboxEmailIds = targetMailboxEmails.map(
        (mailboxEmail) => mailboxEmail.id,
      );
      if (addLabels.length && targetMailboxEmailIds.length) {
        const assignmentRows = targetMailboxEmailIds.flatMap((emailId) =>
          addLabels.map((labelId) => ({
            emailId,
            labelId,
          })),
        );
        await this.emailLabelAssignmentRepo.upsert(assignmentRows, [
          'emailId',
          'labelId',
        ]);
      }
      if (removeLabels.length && targetMailboxEmailIds.length) {
        await this.emailLabelAssignmentRepo.delete({
          emailId: In(targetMailboxEmailIds),
          labelId: In(removeLabels),
        } as any);
      }

      const refreshedMailboxEmails = await this.listMailboxEmailsForUser({
        userId,
        mailboxId: source.id,
        mailboxAddress: source.address,
      });
      const refreshedThreadEmails = refreshedMailboxEmails.filter(
        (email) => this.resolveMailboxThreadKey(email) === anchorThreadKey,
      );
      if (!refreshedThreadEmails.length) {
        throw new NotFoundException('Email not found');
      }
      const resolvedThreadId = this.resolveMailboxThreadKey(
        refreshedThreadEmails[refreshedThreadEmails.length - 1],
      );
      const fallbackId = anchorThreadKey || anchorEmail.id;
      await this.writeAuditLog({
        userId,
        action: 'unified_inbox_thread_updated',
        metadata: {
          ...auditBaseMetadata,
          sourceType: 'MAILBOX',
          mailboxId: source.id,
          mailboxAddress: source.address,
          resolvedThreadId: resolvedThreadId || fallbackId,
          updatedMessages: targetMailboxEmailIds.length,
        },
      });
      return this.getThread(userId, resolvedThreadId || fallbackId);
    }

    const providerId = source.id;

    const existing = await this.externalEmailMessageRepo
      .createQueryBuilder('m')
      .where('m.userId = :userId', { userId })
      .andWhere('m.providerId = :providerId', { providerId })
      .andWhere('(m.threadId = :threadId OR m.externalMessageId = :threadId)', {
        threadId,
      })
      .orderBy('m.internalDate', 'DESC')
      .addOrderBy('m.createdAt', 'DESC')
      .getOne();
    if (!existing) throw new NotFoundException('Email not found');

    const key = existing.threadId || existing.externalMessageId;

    // Compute label changes
    const add = new Set<string>(requestedAddLabelIds);
    const remove = new Set<string>(requestedRemoveLabelIds);

    if (typeof input.read === 'boolean') {
      if (input.read) remove.add('UNREAD');
      else add.add('UNREAD');
    }
    if (typeof input.starred === 'boolean') {
      if (input.starred) add.add('STARRED');
      else remove.add('STARRED');
    }
    if (requestedFolder) {
      const f = requestedFolder;
      if (f === 'inbox') {
        add.add('INBOX');
        remove.add('TRASH');
        remove.add('SPAM');
      } else if (f === 'trash') {
        add.add('TRASH');
        remove.add('INBOX');
      } else if (f === 'spam') {
        add.add('SPAM');
        remove.add('INBOX');
      } else if (f === 'archive') {
        remove.add('INBOX');
        remove.add('TRASH');
        remove.add('SPAM');
      }
    }

    // Apply changes to Gmail (when provider is Gmail) and then persist local state.
    const provider = await this.emailProviderRepo.findOne({
      where: { id: providerId, userId },
    });
    const isGmail = provider?.type === 'GMAIL';
    if (isGmail && provider) {
      const accessToken = await this.ensureFreshGmailAccessToken(provider);
      if (existing.threadId) {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(existing.threadId)}/modify`;
        const res = await this.gmailRequest<any>(
          {
            method: 'POST',
            url,
            headers: { Authorization: `Bearer ${accessToken}` },
            data: {
              addLabelIds: Array.from(add),
              removeLabelIds: Array.from(remove),
            },
          },
          { userId, providerId, op: 'threads.modify' },
        );
        const apiMsgs = res?.messages || [];
        for (const gm of apiMsgs) {
          const labelIds = gm.labelIds || [];
          await this.externalEmailMessageRepo.update(
            { userId, providerId, externalMessageId: gm.id },
            { labels: labelIds },
          );
        }
        this.logger.log(
          serializeStructuredLog({
            event: 'unified_inbox_update_email_gmail_thread_modify_completed',
            userId,
            providerId,
            threadId: existing.threadId,
            updatedMessages: apiMsgs.length,
          }),
        );
        await this.writeAuditLog({
          userId,
          action: 'unified_inbox_thread_updated',
          metadata: {
            ...auditBaseMetadata,
            sourceType: 'PROVIDER',
            providerType: provider.type,
            providerId,
            mode: 'gmail_thread_modify',
            resolvedThreadId: key,
            updatedMessages: apiMsgs.length,
          },
        });
      } else {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(existing.externalMessageId)}/modify`;
        const res = await this.gmailRequest<any>(
          {
            method: 'POST',
            url,
            headers: { Authorization: `Bearer ${accessToken}` },
            data: {
              addLabelIds: Array.from(add),
              removeLabelIds: Array.from(remove),
            },
          },
          { userId, providerId, op: 'messages.modify' },
        );
        const labelIds = res?.labelIds || [];
        await this.externalEmailMessageRepo.update(
          { userId, providerId, externalMessageId: existing.externalMessageId },
          { labels: labelIds },
        );
        this.logger.log(
          serializeStructuredLog({
            event: 'unified_inbox_update_email_gmail_message_modify_completed',
            userId,
            providerId,
            externalMessageId: existing.externalMessageId,
            updatedLabelCount: labelIds.length,
          }),
        );
        await this.writeAuditLog({
          userId,
          action: 'unified_inbox_thread_updated',
          metadata: {
            ...auditBaseMetadata,
            sourceType: 'PROVIDER',
            providerType: provider.type,
            providerId,
            mode: 'gmail_message_modify',
            resolvedThreadId: key,
            updatedMessages: 1,
            updatedLabelCount: labelIds.length,
          },
        });
      }
      return this.getThread(userId, key);
    }

    // Non-Gmail providers: apply label deltas locally to all messages in the thread (or single message fallback).
    const targetWhere = existing.threadId
      ? { userId, providerId, threadId: existing.threadId }
      : { userId, providerId, externalMessageId: existing.externalMessageId };

    const msgs = await this.externalEmailMessageRepo.find({
      where: targetWhere as any,
    });
    for (const m of msgs) {
      const next = new Set(m.labels || []);
      for (const x of add) next.add(x);
      for (const x of remove) next.delete(x);
      await this.externalEmailMessageRepo.update(
        { id: m.id },
        { labels: Array.from(next) },
      );
    }

    this.logger.log(
      serializeStructuredLog({
        event: 'unified_inbox_update_email_local_completed',
        userId,
        providerId,
        threadKey: key,
        addLabels: Array.from(add),
        removeLabels: Array.from(remove),
        updatedMessages: msgs.length,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'unified_inbox_thread_updated',
      metadata: {
        ...auditBaseMetadata,
        sourceType: 'PROVIDER',
        providerType: provider?.type || null,
        providerId,
        mode: 'local_labels_update',
        resolvedThreadId: key,
        updatedMessages: msgs.length,
      },
    });

    return this.getThread(userId, key);
  }

  async listFolders(userId: string): Promise<EmailFolder[]> {
    const source = await this.resolveActiveInboxSource(userId);
    if (!source) {
      return SYSTEM_FOLDERS.map((f) => ({
        id: f.id,
        name: f.name,
        count: 0,
        unreadCount: 0,
      }));
    }

    if (source.type === 'MAILBOX') {
      const mailboxEmails = await this.listMailboxEmailsForUser({
        userId,
        mailboxId: source.id,
        mailboxAddress: source.address,
      });
      const counts = new Map<string, { count: number; unread: number }>();
      for (const folder of SYSTEM_FOLDERS) {
        counts.set(folder.id, { count: 0, unread: 0 });
      }

      for (const mailboxEmail of mailboxEmails) {
        const folder = this.mailboxEmailToFolder(mailboxEmail, source.address);
        const bucket = counts.get(folder) || { count: 0, unread: 0 };
        bucket.count += 1;
        if (this.mailboxEmailIsUnread(mailboxEmail)) {
          bucket.unread += 1;
        }
        counts.set(folder, bucket);
      }

      return SYSTEM_FOLDERS.map((folder) => ({
        id: folder.id,
        name: folder.name,
        count: counts.get(folder.id)?.count || 0,
        unreadCount: counts.get(folder.id)?.unread || 0,
      }));
    }

    const providerId = source.id;
    const msgs = await this.externalEmailMessageRepo.find({
      where: { userId, providerId },
      select: { labels: true } as any,
    });

    const counts = new Map<string, { count: number; unread: number }>();
    for (const f of SYSTEM_FOLDERS) counts.set(f.id, { count: 0, unread: 0 });

    for (const m of msgs) {
      const folder = this.labelsToFolder(m.labels || []);
      const bucket = counts.get(folder) || { count: 0, unread: 0 };
      bucket.count += 1;
      if (this.isUnread(m.labels || [])) bucket.unread += 1;
      counts.set(folder, bucket);
    }

    return SYSTEM_FOLDERS.map((f) => ({
      id: f.id,
      name: f.name,
      count: counts.get(f.id)?.count || 0,
      unreadCount: counts.get(f.id)?.unread || 0,
    }));
  }

  async listLabels(userId: string): Promise<EmailLabel[]> {
    const source = await this.resolveActiveInboxSource(userId);
    if (!source) return [];

    if (source.type === 'MAILBOX') {
      const mailboxEmails = await this.listMailboxEmailsForUser({
        userId,
        mailboxId: source.id,
        mailboxAddress: source.address,
      });
      const mailboxEmailIds = mailboxEmails.map(
        (mailboxEmail) => mailboxEmail.id,
      );
      if (!mailboxEmailIds.length) return [];
      const assignments = await this.emailLabelAssignmentRepo.find({
        where: { emailId: In(mailboxEmailIds) } as any,
        select: {
          emailId: true,
          labelId: true,
        } as any,
      });
      const labelCounts = new Map<string, number>();
      for (const assignment of assignments) {
        const labelId = String(assignment.labelId || '').trim();
        if (!labelId) continue;
        labelCounts.set(labelId, (labelCounts.get(labelId) || 0) + 1);
      }
      const labelIds = Array.from(labelCounts.keys());
      if (!labelIds.length) return [];
      const labelRows = await this.emailLabelRepo.find({
        where: {
          userId,
          id: In(labelIds),
        },
      });
      const labelById = new Map(labelRows.map((label) => [label.id, label]));
      const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
      return labelIds.map((labelId, index) => {
        const label = labelById.get(labelId);
        return {
          id: labelId,
          name: label?.name || `Label ${labelId.slice(0, 8)}`,
          color: label?.color || palette[index % palette.length],
          count: labelCounts.get(labelId) || 0,
        };
      });
    }

    const providerId = source.id;
    const [msgs, meta] = await Promise.all([
      this.externalEmailMessageRepo.find({
        where: { userId, providerId },
        select: { labels: true } as any,
      }),
      this.externalEmailLabelRepo.find({
        where: { userId, providerId },
        select: {
          externalLabelId: true,
          name: true,
          color: true,
          isSystem: true,
          type: true,
        } as any,
      }),
    ]);

    const counts = new Map<string, number>();
    for (const m of msgs) {
      for (const l of m.labels || []) counts.set(l, (counts.get(l) || 0) + 1);
    }

    const metaById = new Map(meta.map((l) => [l.externalLabelId, l]));

    // Hide system labels from the UI label list; show only non-system or unknown labels.
    const ids = Array.from(counts.keys()).filter((id) => {
      const m = metaById.get(id);
      if (m?.isSystem) return false;
      return ![
        'INBOX',
        'SENT',
        'TRASH',
        'SPAM',
        'DRAFT',
        'UNREAD',
        'STARRED',
      ].includes(id);
    });

    return ids.map((id, idx) => {
      const m = metaById.get(id);
      return {
        id,
        name: m?.name || id,
        color:
          m?.color ||
          ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
        count: counts.get(id) || 0,
      };
    });
  }
}
