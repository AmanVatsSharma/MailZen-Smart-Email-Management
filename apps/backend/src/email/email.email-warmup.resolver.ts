import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailWarmupService } from './email.email-warmup.service';
import { StartWarmupInput, PauseWarmupInput } from './dto/warmup.input';
import { EmailWarmup, WarmupPerformanceMetrics } from './models/warmup.model';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => EmailWarmup)
export class EmailWarmupResolver {
  constructor(private readonly emailWarmupService: EmailWarmupService) {}

  @Mutation(() => EmailWarmup)
  @UseGuards(JwtAuthGuard)
  async startEmailWarmup(
    @Args('input') input: StartWarmupInput,
    @Context() context: RequestContext,
  ) {
    return this.emailWarmupService.startWarmup(input, context.req.user.id);
  }

  @Mutation(() => EmailWarmup)
  @UseGuards(JwtAuthGuard)
  async pauseEmailWarmup(
    @Args('input') input: PauseWarmupInput,
    @Context() context: RequestContext,
  ) {
    return this.emailWarmupService.pauseWarmup(input, context.req.user.id);
  }

  @Query(() => EmailWarmup, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async getEmailWarmupStatus(
    @Args('providerId') providerId: string,
    @Context() context: RequestContext,
  ) {
    return this.emailWarmupService.getWarmupStatus(
      providerId,
      context.req.user.id,
    );
  }

  @Query(() => WarmupPerformanceMetrics)
  @UseGuards(JwtAuthGuard)
  async getWarmupPerformanceMetrics(
    @Args('warmupId') warmupId: string,
    @Context() context: RequestContext,
  ) {
    return this.emailWarmupService.getWarmupPerformanceMetrics(warmupId);
  }

  @Mutation(() => EmailWarmup)
  @UseGuards(JwtAuthGuard)
  async adjustWarmupStrategy(
    @Args('warmupId') warmupId: string,
    @Context() context: RequestContext,
  ) {
    return this.emailWarmupService.adjustWarmupStrategy(warmupId);
  }
}
