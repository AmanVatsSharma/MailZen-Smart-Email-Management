import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  private parseMailboxAddress(input: string | null | undefined): { name: string; email: string } | null {
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

  private async resolveActiveProviderId(userId: string, requestedProviderId?: string): Promise<string> {
    if (requestedProviderId) {
      const p = await this.prisma.emailProvider.findFirst({ where: { id: requestedProviderId, userId } });
      if (!p) throw new NotFoundException('Provider not found');
      return p.id;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const activeType = (user as any)?.activeInboxType as string | null;
    const activeId = (user as any)?.activeInboxId as string | null;
    if (activeType === 'PROVIDER' && activeId) {
      const p = await this.prisma.emailProvider.findFirst({ where: { id: activeId, userId } });
      if (p) return p.id;
    }

    // Fallback: first active provider, then newest provider.
    const activeProvider = await this.prisma.emailProvider.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } });
    if (activeProvider) return activeProvider.id;
    const newestProvider = await this.prisma.emailProvider.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (!newestProvider) throw new NotFoundException('No email providers connected');
    return newestProvider.id;
  }

  async listThreads(userId: string, limit = 10, offset = 0, filter?: EmailFilterInput | null, sort?: EmailSortInput | null): Promise<EmailThread[]> {
    const providerId = await this.resolveActiveProviderId(userId, filter?.providerId);

    const where: any = { userId, providerId };
    const search = filter?.search?.trim();
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { from: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter?.labelIds?.length) {
      where.AND = (where.AND || []).concat(filter.labelIds.map(l => ({ labels: { has: l } })));
    }

    if (filter?.status) {
      where.labels = filter.status === 'unread' ? { has: 'UNREAD' } : { hasNone: ['UNREAD'] };
    }

    if (typeof filter?.isStarred === 'boolean') {
      where.labels = filter.isStarred ? { has: 'STARRED' } : { hasNone: ['STARRED'] };
    }

    // Folder filtering via Gmail system labels.
    if (filter?.folder) {
      const f = filter.folder.toLowerCase();
      if (f === 'inbox') where.labels = { has: 'INBOX' };
      else if (f === 'sent') where.labels = { has: 'SENT' };
      else if (f === 'trash') where.labels = { has: 'TRASH' };
      else if (f === 'spam') where.labels = { has: 'SPAM' };
      else if (f === 'archive') where.labels = { hasNone: ['INBOX', 'TRASH', 'SPAM'] };
      else where.labels = { has: f.toUpperCase() };
    }

    const orderBy: any[] = [];
    if (sort?.field === 'from') orderBy.push({ from: sort.direction });
    else if (sort?.field === 'subject') orderBy.push({ subject: sort.direction });
    else orderBy.push({ internalDate: sort?.direction || 'desc' });
    orderBy.push({ createdAt: 'desc' });

    // We paginate at message-level then de-dupe into thread-level (MVP).
    const page = await this.prisma.externalEmailMessage.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: {
        id: true,
        userId: true,
        providerId: true,
        externalMessageId: true,
        threadId: true,
        from: true,
        to: true,
        subject: true,
        snippet: true,
        internalDate: true,
        labels: true,
      },
    });

    this.logger.log(`emails list user=${userId} provider=${providerId} limit=${limit} offset=${offset} returned=${page.length}`);

    return page.map(m => this.mapExternalMessageToThreadSummary(m));
  }

  private mapExternalMessageToThreadSummary(m: ExternalMessage): EmailThread {
    const from = this.parseMailboxAddress(m.from) || { name: 'Unknown', email: 'unknown' };
    const to = (m.to || []).map(x => this.parseMailboxAddress(x)).filter(Boolean) as Array<{ name: string; email: string }>;
    const subject = m.subject || '(no subject)';
    const date = (m.internalDate || new Date()).toISOString();
    const labels = m.labels || [];
    const folder = this.labelsToFolder(labels);
    const isUnread = this.isUnread(labels);
    const isStarred = this.isStarred(labels);
    const contentPreview = m.snippet || '';
    const content = `<p>${this.escapeHtml(contentPreview)}</p>`;
    const threadId = m.threadId || m.externalMessageId;

    const participants = [from, ...to].reduce((acc, p) => {
      if (!acc.find(x => x.email.toLowerCase() === p.email.toLowerCase())) acc.push(p);
      return acc;
    }, [] as Array<{ name: string; email: string }>);

    return {
      id: threadId,
      providerThreadId: m.threadId || undefined,
      subject,
      participants: participants.map(p => ({ name: p.name, email: p.email })),
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
          to: to.map(p => ({ name: p.name, email: p.email })),
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

  async getThread(userId: string, threadId: string): Promise<EmailThread> {
    const providerId = await this.resolveActiveProviderId(userId);
    const msg = await this.prisma.externalEmailMessage.findFirst({
      where: { userId, providerId, OR: [{ threadId }, { externalMessageId: threadId }] },
      orderBy: [{ internalDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (!msg) throw new NotFoundException('Email not found');
    // MVP: return a summary thread. Full message fetch is added in gmail-actions todo.
    return this.mapExternalMessageToThreadSummary(msg as any);
  }

  async updateThread(userId: string, threadId: string, input: EmailUpdateInput): Promise<EmailThread> {
    // MVP: persist local label state only. Gmail API modify is added in gmail-actions todo.
    const providerId = await this.resolveActiveProviderId(userId);

    const existing = await this.prisma.externalEmailMessage.findFirst({
      where: { userId, providerId, OR: [{ threadId }, { externalMessageId: threadId }] },
      orderBy: [{ internalDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (!existing) throw new NotFoundException('Email not found');

    const key = existing.threadId || existing.externalMessageId;

    // Compute label changes
    const add = new Set<string>(input.addLabelIds || []);
    const remove = new Set<string>(input.removeLabelIds || []);

    if (typeof input.read === 'boolean') {
      if (input.read) remove.add('UNREAD');
      else add.add('UNREAD');
    }
    if (typeof input.starred === 'boolean') {
      if (input.starred) add.add('STARRED');
      else remove.add('STARRED');
    }
    if (input.folder) {
      const f = input.folder.toLowerCase();
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

    // Apply label deltas locally to all messages in the thread (or single message fallback).
    const targetWhere = existing.threadId
      ? { userId, providerId, threadId: existing.threadId }
      : { userId, providerId, externalMessageId: existing.externalMessageId };

    const msgs = await this.prisma.externalEmailMessage.findMany({ where: targetWhere });
    for (const m of msgs) {
      const next = new Set(m.labels || []);
      for (const x of add) next.add(x);
      for (const x of remove) next.delete(x);
      await this.prisma.externalEmailMessage.update({ where: { id: m.id }, data: { labels: Array.from(next) } });
    }

    this.logger.log(`updateEmail local user=${userId} provider=${providerId} thread=${key} add=${Array.from(add).join(',')} remove=${Array.from(remove).join(',')}`);

    return this.getThread(userId, key);
  }

  async listFolders(userId: string): Promise<EmailFolder[]> {
    const providerId = await this.resolveActiveProviderId(userId);
    const msgs = await this.prisma.externalEmailMessage.findMany({
      where: { userId, providerId },
      select: { labels: true },
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

    return SYSTEM_FOLDERS.map(f => ({
      id: f.id,
      name: f.name,
      count: counts.get(f.id)?.count || 0,
      unreadCount: counts.get(f.id)?.unread || 0,
    }));
  }

  async listLabels(userId: string): Promise<EmailLabel[]> {
    const providerId = await this.resolveActiveProviderId(userId);
    const msgs = await this.prisma.externalEmailMessage.findMany({
      where: { userId, providerId },
      select: { labels: true },
    });
    const counts = new Map<string, number>();
    for (const m of msgs) {
      for (const l of m.labels || []) counts.set(l, (counts.get(l) || 0) + 1);
    }

    // MVP: label metadata comes from provider label sync todo; return ids only with stable colors.
    const ids = Array.from(counts.keys()).filter(x => !['INBOX', 'SENT', 'TRASH', 'SPAM', 'DRAFT', 'UNREAD', 'STARRED'].includes(x));
    return ids.map((id, idx) => ({
      id,
      name: id,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
      count: counts.get(id) || 0,
    }));
  }
}

