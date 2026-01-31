import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { OAuth2Client } from 'google-auth-library';
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
  private readonly googleOAuth2Client: OAuth2Client;

  constructor(private readonly prisma: PrismaService) {
    this.googleOAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_PROVIDER_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
    );
  }

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

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldRetryGmailStatus(status?: number): boolean {
    if (!status) return false;
    return status === 429 || status === 503 || status === 500 || status === 502 || status === 504;
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
          `[GmailAPI] op=${meta.op} user=${meta.userId} provider=${meta.providerId} attempt=${attempt}/${maxAttempts} status=${status ?? 'n/a'} error=${message}`,
        );

        if (!retriable || attempt >= maxAttempts) {
          this.logger.error(
            `[GmailAPI] op=${meta.op} failed user=${meta.userId} provider=${meta.providerId} status=${status ?? 'n/a'} error=${message}`,
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
      if (mimeType === 'text/html' && bodyData && !acc.html) acc.html = this.decodeBase64Url(bodyData);
      if (mimeType === 'text/plain' && bodyData && !acc.text) acc.text = this.decodeBase64Url(bodyData);
      const parts = part.parts || [];
      for (const p of parts) walk(p, acc);
    };

    const acc: { html?: string; text?: string } = {};
    walk(payload, acc);
    if (acc.html) return acc.html;
    if (acc.text) return `<pre>${this.escapeHtml(acc.text)}</pre>`;
    return '';
  }

  private parseAddressList(input: string | null | undefined): Array<{ name: string; email: string }> {
    if (!input) return [];
    // MVP split; good enough for most cases.
    return input
      .split(',')
      .map(s => this.parseMailboxAddress(s))
      .filter(Boolean) as Array<{ name: string; email: string }>;
  }

  private extractAttachments(payload: any, messageId: string): Array<{ id: string; name: string; type: string; size: number }> {
    const out: Array<{ id: string; name: string; type: string; size: number }> = [];
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
      throw new BadRequestException('Missing OAuth credentials for Gmail provider');
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
      this.googleOAuth2Client.setCredentials({ refresh_token: provider.refreshToken });
      const { credentials } = await this.googleOAuth2Client.refreshAccessToken();
      if (!credentials.access_token) throw new Error('Google refresh did not return access_token');

      await this.prisma.emailProvider.update({
        where: { id: provider.id },
        data: {
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      });
      return credentials.access_token;
    } catch (e: any) {
      this.logger.error(`Failed to refresh Gmail access token: ${e?.message || e}`, e?.stack);
      throw new InternalServerErrorException('Failed to refresh Gmail access token');
    }
  }

  private async getGmailProviderOrThrow(userId: string, providerId: string) {
    const provider = await this.prisma.emailProvider.findFirst({ where: { id: providerId, userId } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.type !== 'GMAIL') throw new BadRequestException('Provider is not Gmail');
    return provider;
  }

  async getThread(userId: string, threadId: string): Promise<EmailThread> {
    const providerId = await this.resolveActiveProviderId(userId);

    const anchor = await this.prisma.externalEmailMessage.findFirst({
      where: { userId, providerId, OR: [{ threadId }, { externalMessageId: threadId }] },
      orderBy: [{ internalDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (!anchor) throw new NotFoundException('Email not found');

    const isThread = !!anchor.threadId;
    const msgs = await this.prisma.externalEmailMessage.findMany({
      where: isThread ? { userId, providerId, threadId: anchor.threadId } : { userId, providerId, externalMessageId: anchor.externalMessageId },
      orderBy: [{ internalDate: 'asc' }, { createdAt: 'asc' }],
    });

    // If Gmail, lazily hydrate full payloads for detail rendering.
    const provider = await this.prisma.emailProvider.findFirst({ where: { id: providerId, userId } });
    const isGmail = provider?.type === 'GMAIL';
    let accessToken: string | null = null;
    if (isGmail && provider) accessToken = await this.ensureFreshGmailAccessToken(provider);

    const mappedMessages: any[] = [];
    for (const m of msgs) {
      let raw: any = m.rawPayload;
      const hasBody = !!raw?.payload?.body?.data || Array.isArray(raw?.payload?.parts);
      if (isGmail && accessToken && !hasBody) {
        // Basic rate limiting: small delay between message fetches.
        await this.sleep(75);
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.externalMessageId)}`;
        const full = await this.gmailRequest<any>(
          { method: 'GET', url, headers: { Authorization: `Bearer ${accessToken}` }, params: { format: 'full' } },
          { userId, providerId, op: 'messages.get(full)' },
        );
        raw = full;
        await this.prisma.externalEmailMessage.update({ where: { id: m.id }, data: { rawPayload: full as any, snippet: full.snippet || m.snippet } });
      }

      const headers = raw?.payload?.headers || [];
      const get = (name: string) => headers.find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value;
      const fromStr = get('From') || m.from || '';
      const toStr = get('To') || (m.to || []).join(', ');
      const ccStr = get('Cc') || '';
      const bccStr = get('Bcc') || '';
      const subject = get('Subject') || m.subject || '(no subject)';
      const dateIso = m.internalDate ? m.internalDate.toISOString() : new Date().toISOString();
      const labels = m.labels || [];

      const from = this.parseMailboxAddress(fromStr) || { name: 'Unknown', email: 'unknown' };
      const to = this.parseAddressList(toStr);
      const cc = this.parseAddressList(ccStr);
      const bcc = this.parseAddressList(bccStr);
      const content = this.extractBodyHtml(raw?.payload) || `<p>${this.escapeHtml(m.snippet || '')}</p>`;
      const contentPreview = m.snippet || '';
      const folder = this.labelsToFolder(labels);

      const attachments = this.extractAttachments(raw?.payload, m.externalMessageId).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
      }));

      mappedMessages.push({
        id: m.id,
        threadId: (m.threadId || m.externalMessageId) as string,
        subject,
        from: { name: from.name, email: from.email },
        to: to.map(p => ({ name: p.name, email: p.email })),
        cc: cc.length ? cc.map(p => ({ name: p.name, email: p.email })) : undefined,
        bcc: bcc.length ? bcc.map(p => ({ name: p.name, email: p.email })) : undefined,
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
      participants.set(msg.from.email.toLowerCase(), { name: msg.from.name, email: msg.from.email });
      for (const p of msg.to || []) participants.set(p.email.toLowerCase(), { name: p.name, email: p.email });
    }

    const threadKey = anchor.threadId || anchor.externalMessageId;
    const threadLabels = (anchor.labels || []) as string[];
    return {
      id: threadKey,
      providerThreadId: anchor.threadId || undefined,
      subject: last?.subject || anchor.subject || '(no subject)',
      participants: Array.from(participants.values()).map(p => ({ name: p.name, email: p.email })),
      lastMessageDate: last?.date || (anchor.internalDate ? anchor.internalDate.toISOString() : new Date().toISOString()),
      isUnread: mappedMessages.some(x => x.status === 'unread' && x.folder === 'inbox'),
      messages: mappedMessages,
      folder: this.labelsToFolder(threadLabels),
      labelIds: threadLabels,
      providerId: anchor.providerId,
      providerThreadId: anchor.threadId || undefined,
    };
  }

  async updateThread(userId: string, threadId: string, input: EmailUpdateInput): Promise<EmailThread> {
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

    // Apply changes to Gmail (when provider is Gmail) and then persist local state.
    const provider = await this.prisma.emailProvider.findFirst({ where: { id: providerId, userId } });
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
            data: { addLabelIds: Array.from(add), removeLabelIds: Array.from(remove) },
          },
          { userId, providerId, op: 'threads.modify' },
        );
        const apiMsgs = res?.messages || [];
        for (const gm of apiMsgs) {
          const labelIds = gm.labelIds || [];
          await this.prisma.externalEmailMessage.updateMany({
            where: { userId, providerId, externalMessageId: gm.id },
            data: { labels: labelIds },
          });
        }
        this.logger.log(`updateEmail gmail threads.modify user=${userId} provider=${providerId} thread=${existing.threadId} ok`);
      } else {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(existing.externalMessageId)}/modify`;
        const res = await this.gmailRequest<any>(
          {
            method: 'POST',
            url,
            headers: { Authorization: `Bearer ${accessToken}` },
            data: { addLabelIds: Array.from(add), removeLabelIds: Array.from(remove) },
          },
          { userId, providerId, op: 'messages.modify' },
        );
        const labelIds = res?.labelIds || [];
        await this.prisma.externalEmailMessage.updateMany({
          where: { userId, providerId, externalMessageId: existing.externalMessageId },
          data: { labels: labelIds },
        });
        this.logger.log(`updateEmail gmail messages.modify user=${userId} provider=${providerId} message=${existing.externalMessageId} ok`);
      }
      return this.getThread(userId, key);
    }

    // Non-Gmail providers: apply label deltas locally to all messages in the thread (or single message fallback).
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
    const [msgs, meta] = await Promise.all([
      this.prisma.externalEmailMessage.findMany({
        where: { userId, providerId },
        select: { labels: true },
      }),
      this.prisma.externalEmailLabel.findMany({
        where: { userId, providerId },
        select: { externalLabelId: true, name: true, color: true, isSystem: true, type: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const m of msgs) {
      for (const l of m.labels || []) counts.set(l, (counts.get(l) || 0) + 1);
    }

    const metaById = new Map(meta.map(l => [l.externalLabelId, l]));

    // Hide system labels from the UI label list; show only non-system or unknown labels.
    const ids = Array.from(counts.keys()).filter(id => {
      const m = metaById.get(id);
      if (m?.isSystem) return false;
      return !['INBOX', 'SENT', 'TRASH', 'SPAM', 'DRAFT', 'UNREAD', 'STARRED'].includes(id);
    });

    return ids.map((id, idx) => {
      const m = metaById.get(id);
      return {
        id,
        name: m?.name || id,
        color: m?.color || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
        count: counts.get(id) || 0,
      };
    });
  }
}

