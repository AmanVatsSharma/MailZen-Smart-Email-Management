/**
 * File:        apps/backend/src/email/email.module.ts
 * Module:      Email · NestJS Module
 * Purpose:     Registers all email-domain providers (service, resolvers, schedulers,
 *              filters, templates, warmup, attachments) and wires up the TypeORM
 *              repositories, Bull queues, and Mailer transport for the email feature.
 *
 * Exports:
 *   - EmailModule  — NestJS module (re-exports EmailService, EmailFilterService,
 *                    EmailTemplateService, AttachmentService, EmailWarmupService)
 *
 * Depends on:
 *   - BillingModule         — exposes RequirePlanGuard for gated email features
 *   - EmailProviderModule   — exposes EmailProviderService for OAuth token refresh
 *
 * Side-effects:
 *   - Registers Bull queue "email" (requires running Redis)
 *   - Registers ScheduleModule (starts cron scheduler)
 *   - Registers MailerModule with SMTP transport from env vars
 *
 * Key invariants:
 *   - SuppressedSender entity is registered here so its repository is injectable
 *     by EmailService for the unsubscribeFromSender feature
 *   - EmailAssignment entity is registered here for tracking thread assignment lifecycle
 *
 * Read order:
 *   1. TypeOrmModule.forFeature([...])  — all entities owned by this module
 *   2. Module imports                   — external modules consumed
 *   3. providers                        — services and resolvers
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './entities/email.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailAnalytics } from '../email-analytics/entities/email-analytics.entity';
import { EmailFilter } from './entities/email-filter.entity';
import { EmailFolder } from './entities/email-folder.entity';
import { EmailLabel } from './entities/email-label.entity';
import { EmailLabelAssignment } from './entities/email-label-assignment.entity';
import { Attachment } from './entities/attachment.entity';
import { EmailWarmup } from './entities/email-warmup.entity';
import { WarmupActivity } from './entities/warmup-activity.entity';
import { SuppressedSender } from './entities/suppressed-sender.entity';
import { EmailAssignment } from './entities/email-assignment.entity';
import { EmailService } from './email.service';
import { EmailResolver } from './email.resolver';
import { EmailController } from './email.controller';
import { EmailSchedulerService } from './email.email-scheduler.service';
import { EmailFilterService } from './email.email-filter.service';
import { EmailFilterResolver } from './email.email-filter.resolver';
import { EmailTemplateService } from './email.email-template.service';
import { EmailTemplateResolver } from './email.email-template.resolver';
import { AttachmentService } from './email.attachment.service';
import { AttachmentResolver } from './email.attachment.resolver';
import { EmailWarmupService } from './email.email-warmup.service';
import { EmailWarmupResolver } from './email.email-warmup.resolver';
import { BillingModule } from '../billing/billing.module';
import { RequirePlanGuard } from '../billing/guards/require-plan.guard';
import { EmailProviderModule } from '../email-integration/email-provider.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { User } from '../user/entities/user.entity';
import { Template } from '../template/entities/template.entity';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailAssignmentService } from './email-assignment.service';
import { EmailAssignmentResolver } from './email-assignment.resolver';
import { NotificationModule } from '../notification/notification.module';

/**
 * EmailModule - Email sending, tracking, and management
 * Handles email operations, scheduling, filtering, and warmup campaigns
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Email,
      EmailProvider,
      EmailAnalytics,
      EmailFilter,
      EmailFolder,
      EmailLabel,
      EmailLabelAssignment,
      Attachment,
      EmailWarmup,
      WarmupActivity,
      SuppressedSender,
      EmailAssignment,
      User,
      Template,
      AuditLog,
    ]),
    ConfigModule,
    BillingModule,
    EmailProviderModule,
    NotificationModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
      defaults: {
        from: '"MailZen" <noreply@mailzen.com>',
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new EjsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailResolver,
    MailService,
    EmailSchedulerService,
    EmailFilterService,
    EmailFilterResolver,
    EmailTemplateService,
    EmailTemplateResolver,
    AttachmentService,
    AttachmentResolver,
    EmailWarmupService,
    EmailWarmupResolver,
    EmailAssignmentService,
    EmailAssignmentResolver,
    RequirePlanGuard,
  ],
  exports: [
    EmailService,
    EmailFilterService,
    EmailTemplateService,
    AttachmentService,
    EmailWarmupService,
    EmailAssignmentService,
  ],
})
export class EmailModule {}
