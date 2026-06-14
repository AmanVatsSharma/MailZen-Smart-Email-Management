// apps/backend/src/composition/modules/platform.module.ts
// Composition for the cross-cutting "platform" contexts (scheduled-email, phone,
// email-analytics, feature, organization, unified-inbox, health).
// All use cases live under core/application/use-cases/<context>/<action>/ as
// `<action>.handler.ts` files following the established convention.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduledEmailOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/scheduled-email.orm-entity';
import { PhoneVerificationOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/phone-verification.orm-entity';
import { TrackingEventOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/tracking-event.orm-entity';
import { TrackingLinkOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/tracking-link.orm-entity';
import { TrackingPixelOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/tracking-pixel.orm-entity';
import { FeatureFlagOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/feature-flag.orm-entity';
import { LabelOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/label.orm-entity';
import { UnifiedThreadOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/unified-thread.orm-entity';
import { InboxFolderOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/inbox-folder.orm-entity';
import { TypeOrmScheduledEmailRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-scheduled-email.repository';
import { TypeOrmPhoneVerificationRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-phone-verification.repository';
import { TypeOrmTrackingEventRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-tracking-event.repository';
import { TypeOrmFeatureFlagRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-feature-flag.repository';
import { TypeOrmLabelRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-label.repository';
import {
  TypeOrmInboxFolderRepository,
  TypeOrmUnifiedThreadRepository,
} from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-unified-inbox.repository';
import { SCHEDULED_EMAIL_REPOSITORY } from '../../core/application/ports/repositories/scheduled-email.repository';
import { PHONE_VERIFICATION_REPOSITORY } from '../../core/application/ports/repositories/phone-verification.repository';
import { TRACKING_EVENT_REPOSITORY } from '../../core/application/ports/repositories/tracking-event.repository';
import { FEATURE_FLAG_REPOSITORY } from '../../core/application/ports/repositories/feature-flag.repository';
import { LABEL_REPOSITORY } from '../../core/application/ports/repositories/label.repository';
import { INBOX_FOLDER_REPOSITORY, UNIFIED_THREAD_REPOSITORY } from '../../core/application/ports/repositories/unified-inbox.repository';
import { SMS_GATEWAY } from '../../core/application/ports/gateways/sms.gateway';
import { ConsoleSmsGateway } from '../../core/infrastructure/external-services/sms/console-sms.gateway';
import { ScheduleEmailHandler } from '../../core/application/use-cases/scheduled-email/schedule-email/schedule-email.handler';
import { CancelScheduledEmailHandler } from '../../core/application/use-cases/scheduled-email/cancel-scheduled-email/cancel-scheduled-email.handler';
import { RequestPhoneVerificationHandler } from '../../core/application/use-cases/phone/request-verification/request-verification.handler';
import { ConfirmPhoneVerificationHandler } from '../../core/application/use-cases/phone/confirm-verification/confirm-verification.handler';
import { RecordTrackingEventHandler } from '../../core/application/use-cases/email-analytics/record-event/record-event.handler';
import { GetEmailStatsHandler } from '../../core/application/use-cases/email-analytics/get-email-stats/get-email-stats.handler';
import { EvaluateFeatureFlagHandler } from '../../core/application/use-cases/feature/evaluate-flag/evaluate-flag.handler';
import { ListFeatureFlagsHandler } from '../../core/application/use-cases/feature/list-flags/list-flags.handler';
import { SetFeatureFlagHandler } from '../../core/application/use-cases/feature/set-flag/set-flag.handler';
import { CreateLabelHandler } from '../../core/application/use-cases/organization/create-label/create-label.handler';
import { ListLabelsHandler } from '../../core/application/use-cases/organization/list-labels/list-labels.handler';
import { DeleteLabelHandler } from '../../core/application/use-cases/organization/delete-label/delete-label.handler';
import { ListUnifiedThreadsHandler } from '../../core/application/use-cases/unified-inbox/list-threads/list-threads.handler';
import { StarUnifiedThreadHandler } from '../../core/application/use-cases/unified-inbox/star-thread/star-thread.handler';
import { MarkThreadReadHandler } from '../../core/application/use-cases/unified-inbox/mark-read/mark-read.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduledEmailOrmEntity,
      PhoneVerificationOrmEntity,
      TrackingEventOrmEntity,
      TrackingLinkOrmEntity,
      TrackingPixelOrmEntity,
      FeatureFlagOrmEntity,
      LabelOrmEntity,
      UnifiedThreadOrmEntity,
      InboxFolderOrmEntity,
    ]),
    BullModule.registerQueue({ name: 'scheduled-email' }),
  ],
  providers: [
    { provide: SCHEDULED_EMAIL_REPOSITORY, useClass: TypeOrmScheduledEmailRepository },
    { provide: PHONE_VERIFICATION_REPOSITORY, useClass: TypeOrmPhoneVerificationRepository },
    { provide: TRACKING_EVENT_REPOSITORY, useClass: TypeOrmTrackingEventRepository },
    { provide: FEATURE_FLAG_REPOSITORY, useClass: TypeOrmFeatureFlagRepository },
    { provide: LABEL_REPOSITORY, useClass: TypeOrmLabelRepository },
    { provide: UNIFIED_THREAD_REPOSITORY, useClass: TypeOrmUnifiedThreadRepository },
    { provide: INBOX_FOLDER_REPOSITORY, useClass: TypeOrmInboxFolderRepository },
    { provide: SMS_GATEWAY, useClass: ConsoleSmsGateway },
    ScheduleEmailHandler,
    CancelScheduledEmailHandler,
    RequestPhoneVerificationHandler,
    ConfirmPhoneVerificationHandler,
    RecordTrackingEventHandler,
    GetEmailStatsHandler,
    EvaluateFeatureFlagHandler,
    ListFeatureFlagsHandler,
    SetFeatureFlagHandler,
    CreateLabelHandler,
    ListLabelsHandler,
    DeleteLabelHandler,
    ListUnifiedThreadsHandler,
    StarUnifiedThreadHandler,
    MarkThreadReadHandler,
  ],
  exports: [TypeOrmModule],
})
export class PlatformModule {}
