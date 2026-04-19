/**
 * File:        apps/backend/src/email/email.resolver.ts
 * Module:      Email · GraphQL Resolver
 * Purpose:     Exposes email queries and mutations over the GraphQL API, delegating
 *              all business logic to EmailService and MailService.
 *
 * Exports:
 *   - EmailResolver  — NestJS GraphQL Resolver (@Resolver)
 *     Queries:
 *       - getMyEmails(providerId?) → Email[]     — [deprecated] list emails for the authed user
 *       - getEmailById(id) → Email               — [deprecated] fetch a single email by ID
 *     Mutations:
 *       - sendEmail(input) → Email               — persist + dispatch an email
 *       - markEmailRead(markEmailReadInput) → Email  — mark an email READ
 *       - sendRealEmail(createEmailInput) → SendRealEmailResponse  — send via real SMTP/OAuth
 *       - unsubscribeFromSender(emailId) → UnsubscribeResult  — archive email + suppress sender
 *       - assignLabel(emailId, labelId) → Email  — assign a label to an email (triage panel)
 *
 * Depends on:
 *   - ./email.service        — business logic for all email operations
 *   - ./mail.service         — real SMTP/OAuth delivery
 *   - ../user/entities/user.entity  — user repo for inbox-type resolution in getMyEmails
 *   - ./dto/unsubscribe-result  — GraphQL return type for unsubscribeFromSender
 *
 * Side-effects:
 *   - DB writes delegated to EmailService (email rows, audit logs, suppressed_senders,
 *     email_label_assignments)
 *   - Outbound email delivery delegated to MailService
 *
 * Key invariants:
 *   - All mutations are scoped to the authenticated user ID extracted from the JWT cookie
 *   - JwtAuthGuard is applied per-mutation (not class-level) to allow mixed access if needed
 *
 * Read order:
 *   1. EmailResolver constructor  — injected services
 *   2. getMyEmails / getEmailById — query handlers
 *   3. sendEmail / markEmailRead / sendRealEmail  — mutation handlers
 *   4. unsubscribeFromSender      — sender-suppression mutation
 *   5. assignLabel                — triage-panel label assignment
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './entities/email.entity';
import { EmailService } from './email.service';
import { CreateEmailInput } from './dto/create-email.input';
import { MarkEmailReadInput } from './dto/mark-email-read.input';
import { MailService } from './mail.service';
import { SendRealEmailResponse } from './dto/send-real-email.response';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SendEmailInput } from './dto/send-email.input';
import { User } from '../user/entities/user.entity';
import { UnsubscribeResult } from './dto/unsubscribe-result';

@Resolver(() => Email)
export class EmailResolver {
  constructor(
    private emailService: EmailService,
    private mailService: MailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Query(() => [Email], {
    deprecationReason: 'Use emails() from UnifiedInboxResolver instead',
  })
  @UseGuards(JwtAuthGuard)
  async getMyEmails(
    @Context() context: { req: { user: { id: string } } },
    // Explicit GraphQL type is required here because TS unions like `string | null` can break reflection.
    @Args('providerId', { type: () => String, nullable: true })
    providerId?: string,
  ) {
    // If providerId not provided, default to user's active inbox selection (when it's a provider).
    let effectiveProviderId = providerId ?? null;
    if (!effectiveProviderId) {
      const user = await this.userRepo.findOne({
        where: { id: context.req.user.id },
      });
      if (
        (user as any)?.activeInboxType === 'PROVIDER' &&
        (user as any)?.activeInboxId
      ) {
        effectiveProviderId = (user as any).activeInboxId;
      }
    }
    return this.emailService.getEmailsByUser(
      context.req.user.id,
      effectiveProviderId,
    );
  }

  @Query(() => Email, {
    deprecationReason: 'Use email(id) from UnifiedInboxResolver instead',
  })
  @UseGuards(JwtAuthGuard)
  async getEmailById(
    @Args('id') id: string,
    @Context() context: { req: { user: { id: string } } },
  ) {
    return this.emailService.getEmailById(id, context.req.user.id);
  }

  @Mutation(() => Email)
  @UseGuards(JwtAuthGuard)
  async sendEmail(
    @Args('input') input: SendEmailInput,
    @Context() context: { req: { user: { id: string } } },
  ) {
    return this.emailService.sendEmail(input, context.req.user.id);
  }

  @Mutation(() => Email)
  @UseGuards(JwtAuthGuard)
  async markEmailRead(
    @Args('markEmailReadInput') markEmailReadInput: MarkEmailReadInput,
    @Context() context: { req: { user: { id: string } } },
  ) {
    return this.emailService.markEmailRead(
      markEmailReadInput.emailId,
      context.req.user.id,
    );
  }

  @Mutation(() => SendRealEmailResponse)
  @UseGuards(JwtAuthGuard)
  async sendRealEmail(
    @Args('createEmailInput') createEmailInput: CreateEmailInput,
    @Context() context: { req: { user: { id: string } } },
  ): Promise<SendRealEmailResponse> {
    const result = await this.mailService.sendRealEmail(
      createEmailInput,
      context.req.user.id,
    );
    return {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    };
  }

  @Mutation(() => UnsubscribeResult)
  @UseGuards(JwtAuthGuard)
  async unsubscribeFromSender(
    @Args('emailId') emailId: string,
    @Context() context: { req: { user: { id: string } } },
  ): Promise<UnsubscribeResult> {
    return this.emailService.unsubscribeFromSender(emailId, context.req.user.id);
  }

  @Mutation(() => Email)
  @UseGuards(JwtAuthGuard)
  async assignLabel(
    @Args('emailId') emailId: string,
    @Args('labelId') labelId: string,
    @Context() context: { req: { user: { id: string } } },
  ): Promise<Email> {
    return this.emailService.assignLabel(emailId, labelId, context.req.user.id);
  }
}
