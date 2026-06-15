// apps/backend/src/core/infrastructure/persistence/typeorm/typeorm.config.ts
// TypeORM module factory. Reads from typed env config; central connection pool settings.

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfig } from '../../../shared/config/env.config';
import { EmailOrmEntity } from './entities/email.orm-entity';
import { UserOrmEntity } from './entities/user.orm-entity';
import { WorkspaceOrmEntity } from './entities/workspace.orm-entity';
import { MembershipOrmEntity } from './entities/membership.orm-entity';
import { PlanOrmEntity } from './entities/plan.orm-entity';
import { SubscriptionOrmEntity } from './entities/subscription.orm-entity';
import { MailboxOrmEntity } from './entities/mailbox.orm-entity';
import { EmailProviderOrmEntity } from './entities/email-provider.orm-entity';
import { AutomationOrmEntity } from './entities/automation.orm-entity';
import { AutomationRunOrmEntity } from './entities/automation-run.orm-entity';
import { ContactOrmEntity } from './entities/contact.orm-entity';
import { NotificationOrmEntity } from './entities/notification.orm-entity';
import { ScheduledEmailOrmEntity } from './entities/scheduled-email.orm-entity';
import { PhoneVerificationOrmEntity } from './entities/phone-verification.orm-entity';
import { FeatureFlagOrmEntity } from './entities/feature-flag.orm-entity';
import { LabelOrmEntity } from './entities/label.orm-entity';
import { SessionOrmEntity } from './entities/session.orm-entity';
import { TrackingPixelOrmEntity } from './entities/tracking-pixel.orm-entity';
import { TrackingLinkOrmEntity } from './entities/tracking-link.orm-entity';
import { SmartReplyOrmEntity } from './entities/smart-reply.orm-entity';
import { TriageResultOrmEntity } from './entities/triage-result.orm-entity';
import { SenderProfileOrmEntity } from './entities/sender-profile.orm-entity';
import { InboxFolderOrmEntity } from './entities/inbox-folder.orm-entity';
import { EmailTemplateOrmEntity } from './entities/email-template.orm-entity';
import { EmailFilterOrmEntity } from './entities/email-filter.orm-entity';
import { EmailWarmupOrmEntity } from './entities/email-warmup.orm-entity';
import { EmailAssignmentOrmEntity } from './entities/email-assignment.orm-entity';
import { AttachmentOrmEntity } from './entities/attachment.orm-entity';
import { ThreadOrmEntity } from './entities/thread.orm-entity';
import { UnifiedThreadOrmEntity } from './entities/unified-thread.orm-entity';

// Single registry of every ORM entity. The composition layer iterates this to wire
// `TypeOrmModule.forFeature([...])` per bounded context.
export const ALL_ORM_ENTITIES = [
  EmailOrmEntity,
  UserOrmEntity,
  WorkspaceOrmEntity,
  MembershipOrmEntity,
  PlanOrmEntity,
  SubscriptionOrmEntity,
  MailboxOrmEntity,
  EmailProviderOrmEntity,
  AutomationOrmEntity,
  AutomationRunOrmEntity,
  ContactOrmEntity,
  NotificationOrmEntity,
  ScheduledEmailOrmEntity,
  PhoneVerificationOrmEntity,
  FeatureFlagOrmEntity,
  LabelOrmEntity,
  SessionOrmEntity,
  TrackingPixelOrmEntity,
  TrackingLinkOrmEntity,
  SmartReplyOrmEntity,
  TriageResultOrmEntity,
  SenderProfileOrmEntity,
  InboxFolderOrmEntity,
  EmailTemplateOrmEntity,
  EmailFilterOrmEntity,
  EmailWarmupOrmEntity,
  EmailAssignmentOrmEntity,
  AttachmentOrmEntity,
  ThreadOrmEntity,
  UnifiedThreadOrmEntity,
];

export function buildTypeOrmOptions(cfg: AppConfig): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: cfg.databaseUrl,
    entities: ALL_ORM_ENTITIES,
    synchronize: cfg.typeormSynchronize,
    poolSize: Number(process.env.TYPEORM_POOL_MAX ?? 10),
    extra: {
      idleTimeoutMillis: Number(process.env.TYPEORM_IDLE_TIMEOUT_MS ?? 30000),
    },
    logging: cfg.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  };
}
