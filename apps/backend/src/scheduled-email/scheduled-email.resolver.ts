import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ScheduledEmail } from './scheduled-email.entity';
import { ScheduledEmailService } from './scheduled-email.service';
import { CreateScheduledEmailInput } from './dto/create-scheduled-email.input';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => ScheduledEmail)
@UseGuards(JwtAuthGuard)
export class ScheduledEmailResolver {
  constructor(private readonly scheduledEmailService: ScheduledEmailService) {}

  @Query(() => [ScheduledEmail], { description: 'Get all scheduled emails' })
  getAllScheduledEmails(
    @Context() context: RequestContext,
  ): Promise<ScheduledEmail[]> {
    return this.scheduledEmailService.getAllScheduledEmails(
      context.req.user.id,
    );
  }

  @Mutation(() => ScheduledEmail, { description: 'Schedule a new email' })
  createScheduledEmail(
    @Args('createScheduledEmailInput')
    createScheduledEmailInput: CreateScheduledEmailInput,
    @Context() context: RequestContext,
  ): Promise<ScheduledEmail> {
    return this.scheduledEmailService.createScheduledEmail(
      createScheduledEmailInput,
      context.req.user.id,
    );
  }
}
