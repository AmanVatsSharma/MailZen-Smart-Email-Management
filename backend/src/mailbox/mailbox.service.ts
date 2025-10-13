import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailboxService {
  constructor(private readonly prisma: PrismaService) {}

  async suggestLocalPart(base: string): Promise<string> {
    const cleaned = base.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
    let candidate = cleaned;
    let suffix = 0;
    // ensure uniqueness
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.mailbox.findFirst({ where: { localPart: candidate, domain: 'mailzen.com' } });
      if (!exists) return candidate;
      suffix += 1;
      candidate = `${cleaned}${suffix}`;
    }
  }

  async createMailbox(userId: string, desiredLocalPart?: string): Promise<{ email: string; id: string }> {
    const base = desiredLocalPart || (await this.deriveBaseFromUser(userId));
    const localPart = await this.suggestLocalPart(base);
    const email = `${localPart}@mailzen.com`;
    const created = await this.prisma.mailbox.create({
      data: { userId, localPart, domain: 'mailzen.com', email },
    });
    return { email: created.email, id: created.id };
  }

  async getUserMailboxes(userId: string) {
    return this.prisma.mailbox.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  private async deriveBaseFromUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const name = user.name || user.email.split('@')[0];
    return name;
  }
}
