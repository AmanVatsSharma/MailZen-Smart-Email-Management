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
import { EmailProviderModule } from '../email-integration/email-provider.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

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
    ]),
    ConfigModule,
    EmailProviderModule,
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
  ],
  exports: [
    EmailService,
    EmailFilterService,
    EmailTemplateService,
    AttachmentService,
    EmailWarmupService,
  ],
})
export class EmailModule {}