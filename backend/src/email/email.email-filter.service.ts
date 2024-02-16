import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailFilterInput, FilterCondition, FilterAction, EmailFilterRule } from './dto/email-filter.input';
import { EmailService } from './email.service';
import { Email, EmailFilter, EmailProvider } from '@prisma/client';

interface EmailWithProvider extends Email {
  provider: EmailProvider;
}

@Injectable()
export class EmailFilterService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async createFilter(input: CreateEmailFilterInput, userId: string): Promise<EmailFilter> {
    return this.prisma.emailFilter.create({
      data: {
        name: input.name,
        rules: input.rules,
        userId,
      },
    });
  }

  async getFilters(userId: string): Promise<EmailFilter[]> {
    return this.prisma.emailFilter.findMany({
      where: { userId },
    });
  }

  async deleteFilter(id: string, userId: string): Promise<EmailFilter> {
    const filter = await this.prisma.emailFilter.findFirst({
      where: { id, userId },
    });

    if (!filter) {
      throw new Error('Filter not found');
    }

    return this.prisma.emailFilter.delete({
      where: { id },
    });
  }

  async applyFilters(emailId: string, userId: string): Promise<void> {
    const email = await this.prisma.email.findFirst({
      where: { id: emailId, userId },
      include: { provider: true },
    }) as EmailWithProvider | null;

    if (!email) {
      throw new Error('Email not found');
    }

    const filters = await this.getFilters(userId);

    for (const filter of filters) {
      for (const rule of filter.rules as EmailFilterRule[]) {
        if (this.matchesRule(email, rule)) {
          await this.executeAction(email, rule);
        }
      }
    }
  }

  private matchesRule(email: EmailWithProvider, rule: EmailFilterRule): boolean {
    const value = (email[rule.field as keyof EmailWithProvider] as string)?.toLowerCase() || '';
    const testValue = rule.value.toLowerCase();

    switch (rule.condition) {
      case FilterCondition.CONTAINS:
        return value.includes(testValue);
      case FilterCondition.EQUALS:
        return value === testValue;
      case FilterCondition.STARTS_WITH:
        return value.startsWith(testValue);
      case FilterCondition.ENDS_WITH:
        return value.endsWith(testValue);
      default:
        return false;
    }
  }

  private async executeAction(email: EmailWithProvider, rule: EmailFilterRule): Promise<void> {
    switch (rule.action) {
      case FilterAction.MARK_READ:
        await this.emailService.markEmailRead(email.id);
        break;
      case FilterAction.MARK_IMPORTANT:
        await this.prisma.email.update({
          where: { id: email.id },
          data: { isImportant: true },
        });
        break;
      case FilterAction.MOVE_TO_FOLDER:
        if (!rule.actionValue) break;
        await this.prisma.email.update({
          where: { id: email.id },
          data: { folderId: rule.actionValue },
        });
        break;
      case FilterAction.APPLY_LABEL:
        if (!rule.actionValue) break;
        await this.prisma.emailLabelAssignment.create({
          data: {
            emailId: email.id,
            labelId: rule.actionValue,
          },
        });
        break;
      case FilterAction.FORWARD_TO:
        if (!rule.actionValue) break;
        await this.emailService.sendEmail(
          {
            subject: `Fwd: ${email.subject}`,
            body: email.body,
            from: email.provider.email,
            to: [rule.actionValue],
            providerId: email.providerId,
          },
          email.userId,
        );
        break;
    }
  }
} 