import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalytics } from './email-analytics.entity';
import { CreateEmailAnalyticsInput } from './dto/create-email-analytics.input';

@Resolver(() => EmailAnalytics)
@UseGuards(JwtAuthGuard)
export class EmailAnalyticsResolver {
  constructor(private readonly emailAnalyticsService: EmailAnalyticsService) {}

  @Query(() => [EmailAnalytics], { description: 'Get all email analytics records' })
  getAllEmailAnalytics(): EmailAnalytics[] {
    return this.emailAnalyticsService.getAllEmailAnalytics();
  }

  @Mutation(() => EmailAnalytics, { description: 'Create a new email analytics record' })
  createEmailAnalytics(
    @Args('createEmailAnalyticsInput') createAnalyticsInput: CreateEmailAnalyticsInput
  ): EmailAnalytics {
    return this.emailAnalyticsService.createEmailAnalytics(createAnalyticsInput);
  }
} 