import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { UserModule } from './user/user.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { FeatureModule } from './feature/feature.module';
import { TemplateModule } from './template/template.module';
import { ScheduledEmailModule } from './scheduled-email/scheduled-email.module';
import { EmailAnalyticsModule } from './email-analytics/email-analytics.module';
import { ContactModule } from './contacts/contact.module';
import { MailboxModule } from './mailbox/mailbox.module';
import { PhoneModule } from './phone/phone.module';
import { InboxModule } from './inbox/inbox.module';
import { GmailSyncModule } from './gmail-sync/gmail-sync.module';
import { UnifiedInboxModule } from './unified-inbox/unified-inbox.module';

@Module({
  imports: [
    // Configuration module to load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // TypeORM configuration for PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      // Auto-sync entities with database (dev mode only)
      synchronize: true,
      // Log only errors for cleaner console output
      logging: ['error'],
      // Auto-discover and load all entities from modules
      autoLoadEntities: true,
      // Connection pool settings for better performance
      extra: {
        max: 10, // Maximum pool size
        idleTimeoutMillis: 30000,
      },
    }),
    
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      // Expose req/res for cookie-based auth and other enterprise concerns (ip/user-agent/auditing)
      context: ({ req, res }) => ({ req, res }),
    }),
    UserModule,
    EmailModule,
    AuthModule,
    FeatureModule,
    TemplateModule,
    ScheduledEmailModule,
    EmailAnalyticsModule,
    ContactModule,
    MailboxModule,
    PhoneModule,
    InboxModule,
    GmailSyncModule,
    UnifiedInboxModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
