import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledEmailService } from './scheduled-email.service';
import { ScheduledEmailResolver } from './scheduled-email.resolver';
import { ScheduledEmail } from './scheduled-email.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduledEmail])],
  providers: [ScheduledEmailService, ScheduledEmailResolver],
  exports: [ScheduledEmailService],
})
export class ScheduledEmailModule {}
