// apps/backend/src/composition/modules/messaging.module.ts
// Composition for the messaging bounded context (email, threads, attachments, templates, filters, warmup, assignments).

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email.orm-entity';
import { ThreadOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/thread.orm-entity';
import { AttachmentOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/attachment.orm-entity';
import { EmailTemplateOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email-template.orm-entity';
import { EmailFilterOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email-filter.orm-entity';
import { EmailWarmupOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email-warmup.orm-entity';
import { EmailAssignmentOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email-assignment.orm-entity';
import { TypeOrmEmailRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-email.repository';
import { TypeOrmThreadRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-thread.repository';
import { TypeOrmAttachmentRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-attachment.repository';
import { TypeOrmEmailTemplateRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-email-template.repository';
import { TypeOrmEmailFilterRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-email-filter.repository';
import { TypeOrmEmailWarmupRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-email-warmup.repository';
import { TypeOrmEmailAssignmentRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-email-assignment.repository';
import { EMAIL_REPOSITORY } from '../../core/application/ports/repositories/email.repository';
import { THREAD_REPOSITORY } from '../../core/application/ports/repositories/thread.repository';
import { ATTACHMENT_REPOSITORY } from '../../core/application/ports/repositories/attachment.repository';
import { EMAIL_TEMPLATE_REPOSITORY } from '../../core/application/ports/repositories/email-template.repository';
import { EMAIL_FILTER_REPOSITORY } from '../../core/application/ports/repositories/email-filter.repository';
import { EMAIL_WARMUP_REPOSITORY } from '../../core/application/ports/repositories/email-warmup.repository';
import { EMAIL_ASSIGNMENT_REPOSITORY } from '../../core/application/ports/repositories/email-assignment.repository';
import { MAIL_GATEWAY } from '../../core/application/ports/gateways/mail.gateway';
import { SmtpMailGateway } from '../../core/infrastructure/external-services/smtp/smtp-mail.gateway';
import { AutomationModule } from './automation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailOrmEntity,
      ThreadOrmEntity,
      AttachmentOrmEntity,
      EmailTemplateOrmEntity,
      EmailFilterOrmEntity,
      EmailWarmupOrmEntity,
      EmailAssignmentOrmEntity,
    ]),
    BullModule.registerQueue({ name: 'email' }),
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST ?? 'localhost',
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
      },
    }),
    forwardRef(() => AutomationModule),
  ],
  providers: [
    { provide: EMAIL_REPOSITORY, useClass: TypeOrmEmailRepository },
    { provide: THREAD_REPOSITORY, useClass: TypeOrmThreadRepository },
    { provide: ATTACHMENT_REPOSITORY, useClass: TypeOrmAttachmentRepository },
    { provide: EMAIL_TEMPLATE_REPOSITORY, useClass: TypeOrmEmailTemplateRepository },
    { provide: EMAIL_FILTER_REPOSITORY, useClass: TypeOrmEmailFilterRepository },
    { provide: EMAIL_WARMUP_REPOSITORY, useClass: TypeOrmEmailWarmupRepository },
    { provide: EMAIL_ASSIGNMENT_REPOSITORY, useClass: TypeOrmEmailAssignmentRepository },
    { provide: MAIL_GATEWAY, useClass: SmtpMailGateway },
  ],
  exports: [
    EMAIL_REPOSITORY,
    THREAD_REPOSITORY,
    ATTACHMENT_REPOSITORY,
    EMAIL_TEMPLATE_REPOSITORY,
    EMAIL_FILTER_REPOSITORY,
    EMAIL_WARMUP_REPOSITORY,
    EMAIL_ASSIGNMENT_REPOSITORY,
    MAIL_GATEWAY,
    TypeOrmModule,
  ],
})
export class MessagingModule {}
