import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Email } from './entities/email.entity';
import { EmailService } from './email.service';
import { CreateEmailInput } from './dto/create-email.input';
import { MarkEmailReadInput } from './dto/mark-email-read.input';
import { MailService } from './mail.service';
import { SendRealEmailResponse } from './dto/send-real-email.response';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SendEmailInput } from './dto/send-email.input';
import { PrismaService } from '../prisma/prisma.service';

@Resolver(() => Email)
export class EmailResolver {
  constructor(
    private emailService: EmailService,
    private mailService: MailService,
    private prisma: PrismaService,
  ) {}

  @Query(() => [Email])
  @UseGuards(JwtAuthGuard)
  async getMyEmails(
    @Context() context: { req: { user: { id: string } } },
    @Args('providerId', { nullable: true }) providerId?: string | null,
  ) {
    // If providerId not provided, default to user's active inbox selection (when it's a provider).
    let effectiveProviderId = providerId ?? null;
    if (!effectiveProviderId) {
      const user = await this.prisma.user.findUnique({ where: { id: context.req.user.id } });
      if ((user as any)?.activeInboxType === 'PROVIDER' && (user as any)?.activeInboxId) {
        effectiveProviderId = (user as any).activeInboxId;
      }
    }
    return this.emailService.getEmailsByUser(context.req.user.id, effectiveProviderId);
  }

  @Query(() => Email)
  @UseGuards(JwtAuthGuard)
  async getEmailById(
    @Args('id') id: string,
    @Context() context: { req: { user: { id: string } } },
  ) {
    return this.emailService.getEmailById(id, context.req.user.id);
  }

  @Mutation(() => Email)
  @UseGuards(JwtAuthGuard)
  async sendEmail(
    @Args('input') input: SendEmailInput,
    @Context() context: { req: { user: { id: string } } },
  ) {
    return this.emailService.sendEmail(input, context.req.user.id);
  }

  @Mutation(() => Email)
  async markEmailRead(@Args('markEmailReadInput') markEmailReadInput: MarkEmailReadInput) {
    return this.emailService.markEmailRead(markEmailReadInput.emailId);
  }

  @Mutation(() => SendRealEmailResponse)
  async sendRealEmail(@Args('createEmailInput') createEmailInput: CreateEmailInput): Promise<SendRealEmailResponse> {
    const result = await this.mailService.sendRealEmail(createEmailInput);
    return {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    };
  }
}