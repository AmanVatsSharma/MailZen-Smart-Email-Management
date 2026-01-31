import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyInput } from './dto/smart-reply.input';

@Resolver()
@UseGuards(JwtAuthGuard)
export class SmartReplyResolver {
  constructor(private readonly smartReplyService: SmartReplyService) {}

  @Query(() => String, { description: 'Generate a smart reply for a conversation' })
  async generateSmartReply(@Args('input') input: SmartReplyInput): Promise<string> {
    return this.smartReplyService.generateReply(input);
  }
  
  @Query(() => [String], { description: 'Get suggested replies for an email' })
  async getSuggestedReplies(
    @Args('emailBody') emailBody: string,
    @Args('count', { type: () => Int, defaultValue: 3 }) count: number
  ): Promise<string[]> {
    return this.smartReplyService.getSuggestedReplies(emailBody, count);
  }
}