import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SenderProfile } from './entities/sender-profile.entity';
import { SenderIntelligenceService } from './sender-intelligence.service';

@Resolver(() => SenderProfile)
@UseGuards(GqlAuthGuard)
export class SenderIntelligenceResolver {
  constructor(private readonly senderService: SenderIntelligenceService) {}

  @Query(() => SenderProfile, { nullable: true, name: 'senderProfile' })
  async getSenderProfile(
    @CurrentUser() user: { id: string },
    @Args('email') email: string,
  ): Promise<SenderProfile | null> {
    return this.senderService.getSenderProfile(user.id, email);
  }

  @Query(() => [SenderProfile], { name: 'topSenders' })
  async getTopSenders(
    @CurrentUser() user: { id: string },
    @Args('limit', { defaultValue: 10 }) limit: number,
  ): Promise<SenderProfile[]> {
    return this.senderService.getTopSenders(user.id, limit);
  }

  @Query(() => [SenderProfile], { name: 'vipSenders' })
  async getVipSenders(
    @CurrentUser() user: { id: string },
  ): Promise<SenderProfile[]> {
    return this.senderService.getVipSenders(user.id);
  }

  @Mutation(() => SenderProfile, { nullable: true, name: 'setSenderVip' })
  async setSenderVip(
    @CurrentUser() user: { id: string },
    @Args('email') email: string,
    @Args('isVip') isVip: boolean,
  ): Promise<SenderProfile | null> {
    return this.senderService.setVip(user.id, email, isVip);
  }
}
