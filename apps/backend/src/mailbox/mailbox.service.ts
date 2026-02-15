import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { MailServerService } from './mail-server.service';
import { Mailbox } from './entities/mailbox.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class MailboxService {
  private static readonly MAILZEN_DOMAIN = 'mailzen.com';
  private static readonly LOCAL_PART_PATTERN =
    /^[a-z0-9]+(?:[a-z0-9.]{1,28}[a-z0-9])?$/;

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailServer: MailServerService,
    private readonly billingService: BillingService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  private normalizeHandle(raw: string): string {
    return raw.trim().toLowerCase();
  }

  private validateDesiredLocalPart(raw: string): string {
    const normalized = this.normalizeHandle(raw);
    if (!MailboxService.LOCAL_PART_PATTERN.test(normalized)) {
      throw new BadRequestException(
        'Invalid mailbox handle. Use 3-30 lowercase letters/numbers/dots. Dot cannot start or end the handle.',
      );
    }
    return normalized;
  }

  async suggestLocalPart(base: string): Promise<string> {
    const cleanedBase = base
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '')
      .slice(0, 30);
    const cleaned = cleanedBase.length >= 3 ? cleanedBase : 'mailzen.user';
    let candidate = cleaned;
    let suffix = 0;

    while (true) {
      const exists = await this.mailboxRepo.findOne({
        where: {
          localPart: candidate,
          domain: MailboxService.MAILZEN_DOMAIN,
        },
      });
      if (!exists) return candidate;
      suffix += 1;
      const maxBaseLength = Math.max(3, 30 - `${suffix}`.length);
      const baseWithLimit = cleaned.slice(0, maxBaseLength).replace(/\.$/, '');
      candidate = `${baseWithLimit}${suffix}`;
    }
  }

  async createMailbox(
    userId: string,
    desiredLocalPart?: string,
  ): Promise<{ email: string; id: string }> {
    await this.enforceMailboxLimit(userId);
    const workspaceId = await this.resolveDefaultWorkspaceId(userId);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let localPart: string;
    if (desiredLocalPart) {
      localPart = this.validateDesiredLocalPart(desiredLocalPart);
      const existing = await this.mailboxRepo.findOne({
        where: {
          localPart,
          domain: MailboxService.MAILZEN_DOMAIN,
        },
      });
      if (existing) {
        throw new ConflictException(
          'This @mailzen.com address is already taken',
        );
      }
    } else {
      const base = await this.deriveBaseFromUser(userId);
      localPart = await this.suggestLocalPart(base);
    }

    const email = `${localPart}@${MailboxService.MAILZEN_DOMAIN}`;
    const created = await this.mailboxRepo.save(
      this.mailboxRepo.create({
        userId,
        workspaceId,
        localPart,
        domain: MailboxService.MAILZEN_DOMAIN,
        email,
      }),
    );
    // Provision on self-hosted server
    await this.mailServer.provisionMailbox(userId, localPart);
    return { email: created.email, id: created.id };
  }

  async getUserMailboxes(userId: string) {
    return this.mailboxRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private async deriveBaseFromUser(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const name = user.name || user.email.split('@')[0];
    return name;
  }

  private async enforceMailboxLimit(userId: string): Promise<void> {
    const entitlements = await this.billingService.getEntitlements(userId);
    const currentMailboxCount = await this.mailboxRepo.count({
      where: { userId },
    });
    if (currentMailboxCount < entitlements.mailboxLimit) return;

    throw new BadRequestException(
      `Plan limit reached. Your ${entitlements.planCode} plan supports up to ${entitlements.mailboxLimit} mailboxes.`,
    );
  }

  private async resolveDefaultWorkspaceId(userId: string): Promise<string> {
    const workspaces = await this.workspaceService.listMyWorkspaces(userId);
    const preferredWorkspace =
      workspaces.find((workspace) => workspace.isPersonal) || workspaces[0];
    if (!preferredWorkspace) {
      throw new BadRequestException('No workspace available for this user');
    }
    return preferredWorkspace.id;
  }
}
