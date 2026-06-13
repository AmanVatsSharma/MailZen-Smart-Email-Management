// apps/backend/src/composition/modules/messaging.module.ts
// Composition for the messaging bounded context.

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
import { EMAIL_REPOSITORY } from '../../core/application/ports/repositories/email.repository';
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
    { provide: MAIL_GATEWAY, useClass: SmtpMailGateway },
  ],
  exports: [EMAIL_REPOSITORY, MAIL_GATEWAY],
})
export class MessagingModule {}
