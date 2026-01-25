import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  constructor(private readonly prisma: PrismaService) {}

  async listUserInboxes(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [mailboxes, providers] = await Promise.all([
      this.prisma.mailbox.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.emailProvider.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const activeType = (user as any).activeInboxType as string | null;
    const activeId = (user as any).activeInboxId as string | null;

    const mailboxInboxes = mailboxes.map(m => ({
      id: m.id,
      type: 'MAILBOX',
      address: m.email,
      isActive: activeType === 'MAILBOX' && activeId === m.id,
      status: m.status,
    }));

    const providerInboxes = providers.map(p => ({
      id: p.id,
      type: 'PROVIDER',
      address: p.email,
      isActive: activeType === 'PROVIDER' && activeId === p.id,
      status: (p as any).status || 'connected',
    }));

    return [...mailboxInboxes, ...providerInboxes];
  }

  async setActiveInbox(userId: string, type: 'MAILBOX' | 'PROVIDER', id: string) {
    // Ownership validation + consistent "active" flags
    if (type === 'MAILBOX') {
      const mailbox = await this.prisma.mailbox.findFirst({ where: { id, userId } });
      if (!mailbox) throw new NotFoundException('Mailbox not found');

      // Deactivate all external providers for UI consistency
      await this.prisma.emailProvider.updateMany({ where: { userId }, data: { isActive: false } });
      await this.prisma.user.update({ where: { id: userId }, data: { activeInboxType: 'MAILBOX', activeInboxId: id } as any });
      this.logger.log(`Set active inbox to MAILBOX ${mailbox.email} for user=${userId}`);
      return this.listUserInboxes(userId);
    }

    const provider = await this.prisma.emailProvider.findFirst({ where: { id, userId } });
    if (!provider) throw new NotFoundException('Provider not found');

    // Toggle provider active flag (single active provider)
    await this.prisma.emailProvider.updateMany({ where: { userId }, data: { isActive: false } });
    await this.prisma.emailProvider.update({ where: { id }, data: { isActive: true } });
    await this.prisma.user.update({ where: { id: userId }, data: { activeInboxType: 'PROVIDER', activeInboxId: id } as any });

    this.logger.log(`Set active inbox to PROVIDER ${provider.email} for user=${userId}`);
    return this.listUserInboxes(userId);
  }
}

