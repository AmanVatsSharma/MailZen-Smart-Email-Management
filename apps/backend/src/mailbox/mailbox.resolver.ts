import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MailboxService } from './mailbox.service';

interface RequestContext {
  req: { user: { id: string } };
}

@Resolver('Mailbox')
@UseGuards(JwtAuthGuard)
export class MailboxResolver {
  constructor(private readonly mailboxService: MailboxService) {}

  @Mutation(() => String)
  async createMyMailbox(
    @Context() ctx: RequestContext,
    @Args('desiredLocalPart', { type: () => String, nullable: true })
    desiredLocalPart?: string,
  ) {
    const result = await this.mailboxService.createMailbox(
      ctx.req.user.id,
      desiredLocalPart,
    );
    return result.email;
  }

  @Query(() => [String])
  async myMailboxes(@Context() ctx: RequestContext) {
    const boxes = await this.mailboxService.getUserMailboxes(ctx.req.user.id);
    return boxes.map((b) => b.email);
  }
}
