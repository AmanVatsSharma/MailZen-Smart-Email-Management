import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailTemplateService } from './email.email-template.service';
import { CreateEmailTemplateInput, UpdateEmailTemplateInput } from './dto/email-template.input';
import { Template } from './models/template.model';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => Template)
export class EmailTemplateResolver {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Mutation(() => Template)
  @UseGuards(JwtAuthGuard)
  async createEmailTemplate(
    @Args('input') input: CreateEmailTemplateInput,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.createTemplate(input, context.req.user.id);
  }

  @Mutation(() => Template)
  @UseGuards(JwtAuthGuard)
  async updateEmailTemplate(
    @Args('id') id: string,
    @Args('input') input: UpdateEmailTemplateInput,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.updateTemplate(id, input, context.req.user.id);
  }

  @Mutation(() => Template)
  @UseGuards(JwtAuthGuard)
  async deleteEmailTemplate(
    @Args('id') id: string,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.deleteTemplate(id, context.req.user.id);
  }

  @Query(() => [Template])
  @UseGuards(JwtAuthGuard)
  async getEmailTemplates(@Context() context: RequestContext) {
    return this.emailTemplateService.getTemplates(context.req.user.id);
  }

  @Query(() => Template)
  @UseGuards(JwtAuthGuard)
  async getEmailTemplate(
    @Args('id') id: string,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.getTemplateById(id, context.req.user.id);
  }

  @Query(() => String)
  @UseGuards(JwtAuthGuard)
  async renderEmailTemplate(
    @Args('id') id: string,
    @Args('variables', { type: () => Object }) variables: Record<string, any>,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.renderTemplate(id, variables);
  }
} 