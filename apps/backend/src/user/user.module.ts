import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { UserSubscription } from '../billing/entities/user-subscription.entity';
import { BillingInvoice } from '../billing/entities/billing-invoice.entity';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

/**
 * UserModule - User management and authentication
 * Provides user CRUD operations and validation
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuditLog,
      EmailProvider,
      Mailbox,
      WorkspaceMember,
      UserSubscription,
      BillingInvoice,
      UserNotification,
    ]),
  ],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
