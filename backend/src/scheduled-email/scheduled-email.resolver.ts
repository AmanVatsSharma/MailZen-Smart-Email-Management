import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ScheduledEmail } from './scheduled-email.entity';
import { ScheduledEmailService } from './scheduled-email.service';
import { CreateScheduledEmailInput } from './dto/create-scheduled-email.input';

@Resolver(() => ScheduledEmail)
@UseGuards(JwtAuthGuard)
export class ScheduledEmailResolver {
  constructor(private readonly scheduledEmailService: ScheduledEmailService) {}

  @Query(() => [ScheduledEmail], { description: 'Get all scheduled emails' })
  getAllScheduledEmails(): ScheduledEmail[] {
    return this.scheduledEmailService.getAllScheduledEmails();
  }

  @Mutation(() => ScheduledEmail, { description: 'Schedule a new email' })
  createScheduledEmail(@Args('createScheduledEmailInput') createScheduledEmailInput: CreateScheduledEmailInput): ScheduledEmail {
    return this.scheduledEmailService.createScheduledEmail(createScheduledEmailInput);
  }
} 