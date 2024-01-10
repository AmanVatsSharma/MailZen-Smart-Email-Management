import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UserModule } from './user/user.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { FeatureModule } from './feature/feature.module';
import { TemplateModule } from './template/template.module';
import { ScheduledEmailModule } from './scheduled-email/scheduled-email.module';
import { EmailAnalyticsModule } from './email-analytics/email-analytics.module';
import { ContactModule } from './contacts/contact.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    }),
    UserModule,
    EmailModule,
    AuthModule,
    FeatureModule,
    TemplateModule,
    ScheduledEmailModule,
    EmailAnalyticsModule,
    ContactModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
