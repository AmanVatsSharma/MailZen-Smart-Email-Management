import { Resolver, Query, Args, Int, Context, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyInput } from './dto/smart-reply.input';
import { UpdateSmartReplySettingsInput } from './dto/update-smart-reply-settings.input';
import { SmartReplyHistoryPurgeResponse } from './entities/smart-reply-history-purge.response';
import { SmartReplyHistory } from './entities/smart-reply-history.entity';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class SmartReplyResolver {
  constructor(private readonly smartReplyService: SmartReplyService) {}

  @Query(() => String, {
    description: 'Generate a smart reply for a conversation',
  })
  async generateSmartReply(
    @Args('input') input: SmartReplyInput,
    @Context() context: RequestContext,
  ): Promise<string> {
    return this.smartReplyService.generateReply(input, context.req.user.id);
  }

  @Query(() => [String], { description: 'Get suggested replies for an email' })
  async getSuggestedReplies(
    @Args('emailBody') emailBody: string,
    @Args('count', { type: () => Int, defaultValue: 3 }) count: number,
    @Context() context: RequestContext,
  ): Promise<string[]> {
    return this.smartReplyService.getSuggestedReplies(
      emailBody,
      count,
      context.req.user.id,
    );
  }

  @Query(() => SmartReplySettings, {
    description: 'Get smart reply settings for current user',
  })
  async smartReplySettings(
    @Context() context: RequestContext,
  ): Promise<SmartReplySettings> {
    return this.smartReplyService.getSettings(context.req.user.id);
  }

  @Mutation(() => SmartReplySettings, {
    description: 'Update smart reply settings for current user',
  })
  async updateSmartReplySettings(
    @Args('input') input: UpdateSmartReplySettingsInput,
    @Context() context: RequestContext,
  ): Promise<SmartReplySettings> {
    return this.smartReplyService.updateSettings(context.req.user.id, input);
  }

  @Query(() => [SmartReplyHistory], {
    description: 'Get smart reply generation history for current user',
  })
  async mySmartReplyHistory(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context() context: RequestContext,
  ): Promise<SmartReplyHistory[]> {
    return this.smartReplyService.listHistory(context.req.user.id, limit);
  }

  @Mutation(() => SmartReplyHistoryPurgeResponse, {
    description: 'Purge smart reply generation history for current user',
  })
  async purgeMySmartReplyHistory(
    @Context() context: RequestContext,
  ): Promise<SmartReplyHistoryPurgeResponse> {
    const result = await this.smartReplyService.purgeHistory(
      context.req.user.id,
    );
    return {
      purgedRows: result.purgedRows,
      executedAtIso: new Date().toISOString(),
    };
  }
}
