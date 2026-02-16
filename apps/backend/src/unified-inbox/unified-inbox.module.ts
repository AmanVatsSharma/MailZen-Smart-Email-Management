import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnifiedInboxResolver } from './unified-inbox.resolver';
import { UnifiedInboxService } from './unified-inbox.service';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { Email } from '../email/entities/email.entity';
import { EmailLabel } from '../email/entities/email-label.entity';
import { EmailLabelAssignment } from '../email/entities/email-label-assignment.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailProvider,
      ExternalEmailLabel,
      ExternalEmailMessage,
      Email,
      EmailLabel,
      EmailLabelAssignment,
      Mailbox,
      User,
    ]),
  ],
  providers: [UnifiedInboxResolver, UnifiedInboxService],
  exports: [UnifiedInboxService],
})
export class UnifiedInboxModule {}
