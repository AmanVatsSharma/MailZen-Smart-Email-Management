// apps/backend/src/composition/modules/mailbox.module.ts
// Composition for the mailbox bounded context.

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailboxOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/mailbox.orm-entity';
import { EmailProviderOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email-provider.orm-entity';
import { TypeOrmMailboxRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmEmailProviderRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-email-provider.repository';
import { MAILBOX_REPOSITORY } from '../../core/application/ports/repositories/mailbox.repository';
import { EMAIL_PROVIDER_REPOSITORY } from '../../core/application/ports/repositories/email-provider.repository';
import { ConnectMailboxHandler } from '../../core/application/use-cases/mailbox/connect-mailbox/connect-mailbox.handler';
import { DisconnectMailboxHandler } from '../../core/application/use-cases/mailbox/disconnect-mailbox/disconnect-mailbox.handler';
import { ListMailboxesHandler } from '../../core/application/use-cases/mailbox/list-mailboxes/list-mailboxes.handler';
import { SetPrimaryMailboxHandler } from '../../core/application/use-cases/mailbox/set-primary-mailbox/set-primary-mailbox.handler';
import { ProcessPubSubNotificationHandler } from '../../core/application/use-cases/mailbox/process-pubsub-notification/process-pubsub-notification.handler';
import { RefreshProviderTokensHandler } from '../../core/application/use-cases/mailbox/refresh-provider-tokens/refresh-provider-tokens.handler';
import { SyncMailboxHandler } from '../../core/application/use-cases/mailbox/sync-mailbox/sync-mailbox.handler';
import { IdentityModule } from './identity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailboxOrmEntity, EmailProviderOrmEntity]),
    forwardRef(() => IdentityModule),
  ],
  providers: [
    { provide: MAILBOX_REPOSITORY, useClass: TypeOrmMailboxRepository },
    { provide: EMAIL_PROVIDER_REPOSITORY, useClass: TypeOrmEmailProviderRepository },
    ConnectMailboxHandler,
    DisconnectMailboxHandler,
    ListMailboxesHandler,
    SetPrimaryMailboxHandler,
    ProcessPubSubNotificationHandler,
    RefreshProviderTokensHandler,
    SyncMailboxHandler,
  ],
  exports: [MAILBOX_REPOSITORY, EMAIL_PROVIDER_REPOSITORY, TypeOrmModule],
})
export class MailboxModule {}
