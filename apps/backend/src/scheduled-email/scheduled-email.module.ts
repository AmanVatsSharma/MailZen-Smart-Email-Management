import { Module } from '@nestjs/common';
import { ScheduledEmailService } from './scheduled-email.service';
import { ScheduledEmailResolver } from './scheduled-email.resolver';

@Module({
  providers: [ScheduledEmailService, ScheduledEmailResolver],
  exports: [ScheduledEmailService],
})
export class ScheduledEmailModule {} 