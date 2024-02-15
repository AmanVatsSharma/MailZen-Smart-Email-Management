import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AttachmentService } from './email.attachment.service';
import { CreateAttachmentInput, DeleteAttachmentInput } from './dto/attachment.input';
import { Attachment } from './models/attachment.model';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => Attachment)
export class AttachmentResolver {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Mutation(() => Attachment)
  @UseGuards(JwtAuthGuard)
  async uploadAttachment(
    @Args('input') input: CreateAttachmentInput,
    @Context() context: RequestContext,
  ) {
    return this.attachmentService.uploadAttachment(input, context.req.user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteAttachment(
    @Args('input') input: DeleteAttachmentInput,
    @Context() context: RequestContext,
  ) {
    return this.attachmentService.deleteAttachment(input, context.req.user.id);
  }

  @Query(() => [Attachment])
  @UseGuards(JwtAuthGuard)
  async getAttachments(
    @Args('emailId') emailId: string,
    @Context() context: RequestContext,
  ) {
    return this.attachmentService.getAttachments(emailId, context.req.user.id);
  }
} 