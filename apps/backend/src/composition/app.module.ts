// apps/backend/src/composition/app.module.ts
// The new AppModule. One import per bounded context. ~30 lines.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { envConfig } from '../../shared/config/env.config';
import { buildTypeOrmOptions } from '../core/infrastructure/persistence/typeorm/typeorm.config';
import { IdentityModule } from './modules/identity.module';
import { WorkspacesModule } from './modules/workspaces.module';
import { MessagingModule } from './modules/messaging.module';
import { MailboxModule } from './modules/mailbox.module';
import { BillingModule } from './modules/billing.module';
import { AiModule } from './modules/ai.module';
import { AutomationModule } from './modules/automation.module';
import { NotificationsModule } from './modules/notifications.module';
import { ObservabilityModule } from './modules/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => buildTypeOrmOptions(cfg.get('env') as never),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      context: ({ req, res }) => ({ req, res }),
    }),
    IdentityModule,
    WorkspacesModule,
    MessagingModule,
    MailboxModule,
    BillingModule,
    AiModule,
    AutomationModule,
    NotificationsModule,
    ObservabilityModule,
  ],
})
export class AppModule {}
