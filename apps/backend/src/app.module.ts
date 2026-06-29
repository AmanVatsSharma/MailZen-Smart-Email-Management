import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { join } from 'path';
import { UserModule } from './user/user.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { FeatureModule } from './feature/feature.module';
import { BillingModule } from './billing/billing.module';
import { NotificationModule } from './notification/notification.module';
import { TemplateModule } from './template/template.module';
import { ScheduledEmailModule } from './scheduled-email/scheduled-email.module';
import { EmailAnalyticsModule } from './email-analytics/email-analytics.module';
import { ContactModule } from './contacts/contact.module';
import { MailboxModule } from './mailbox/mailbox.module';
import { PhoneModule } from './phone/phone.module';
import { InboxModule } from './inbox/inbox.module';
import { GmailSyncModule } from './gmail-sync/gmail-sync.module';
import { OutlookSyncModule } from './outlook-sync/outlook-sync.module';
import { UnifiedInboxModule } from './unified-inbox/unified-inbox.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { SmartReplyModule } from './smart-replies/smart-reply.module';
import { LabelModule } from './organization/label.module';
import { AiAgentGatewayModule } from './ai-agent-gateway/ai-agent-gateway.module';
import { SenderIntelligenceModule } from './sender-intelligence/sender-intelligence.module';
import { HealthModule } from './health/health.module';
import { InboxTriageModule } from './inbox-triage/inbox-triage.module';
import { AutomationModule } from './automation/automation.module';
import { buildTypeOrmModuleOptions } from './database/typeorm.config';

@Module({
  imports: [
    SentryModule.forRoot(),

    // Configuration module to load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM configuration for PostgreSQL.
    // Uses local-dev-only synchronize policy from centralized config.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmModuleOptions(configService),
    }),

    // Global Redis configuration for Bull Queues
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const password = configService.get<string>('REDIS_PASSWORD');
        if (password) {
          password = password.replace(/^["']|["']$/g, '');
        }
        return {
          redis: {
            host: configService.get('REDIS_HOST') || 'localhost',
            port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
            password: password || undefined,
          },
        };
      },
    }),

    // NOTE: For local dev we explicitly avoid Apollo Server Express 5 integration requirements.
    // This keeps `nx serve backend` runnable without additional Express5 adapter packages.
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: process.env.NODE_ENV === 'production' ? true : join(process.cwd(), 'src/schema.gql'),
      context: ({ req, res }) => ({ req, res }),
      // Disable landing page in dev to reduce optional dependencies
      playground: true,
      plugins: [],
    }),
    UserModule,
    EmailModule,
    AuthModule,
    FeatureModule,
    BillingModule,
    NotificationModule,
    TemplateModule,
    ScheduledEmailModule,
    EmailAnalyticsModule,
    ContactModule,
    MailboxModule,
    PhoneModule,
    InboxModule,
    GmailSyncModule,
    OutlookSyncModule,
    UnifiedInboxModule,
    WorkspaceModule,
    SmartReplyModule,
    LabelModule,
    AiAgentGatewayModule,
    SenderIntelligenceModule,
    HealthModule,
    InboxTriageModule,
    AutomationModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
