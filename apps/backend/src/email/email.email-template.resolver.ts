import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EmailTemplateService } from './email.email-template.service';
import {
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
} from './dto/email-template.input';
import { EmailTemplate } from './models/template.model';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => EmailTemplate)
export class EmailTemplateResolver {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Mutation(() => EmailTemplate)
  @UseGuards(JwtAuthGuard)
  async createEmailTemplate(
    @Args('input') input: CreateEmailTemplateInput,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.createTemplate(input, context.req.user.id);
  }

  @Mutation(() => EmailTemplate)
  @UseGuards(JwtAuthGuard)
  async updateEmailTemplate(
    @Args('id') id: string,
    @Args('input') input: UpdateEmailTemplateInput,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.updateTemplate(
      id,
      input,
      context.req.user.id,
    );
  }

  @Mutation(() => EmailTemplate)
  @UseGuards(JwtAuthGuard)
  async deleteEmailTemplate(
    @Args('id') id: string,
    @Context() context: RequestContext,
  ) {
    return this.emailTemplateService.deleteTemplate(id, context.req.user.id);
  }

  @Query(() => [EmailTemplate])
  @UseGuards(JwtAuthGuard)
  async getEmailTemplates(@Context() context: RequestContext) {
    return this.emailTemplateService.getTemplates(context.req.user.id);
  }

  @Query(() => EmailTemplate)
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
    // GraphQL doesn't support arbitrary Object inputs without a JSON scalar.
    // MVP approach: accept JSON as a string and parse server-side.
    @Args('variables', { type: () => String, nullable: true })
    variablesJson: string,
    @Context() context: RequestContext,
  ) {
    let variables: Record<string, any> = {};
    if (variablesJson && variablesJson.trim().length > 0) {
      try {
        const parsed = JSON.parse(variablesJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          variables = parsed;
        } else {
          throw new Error('variables must be a JSON object');
        }
      } catch (e: any) {
        throw new BadRequestException(
          `Invalid variables JSON: ${e?.message || 'parse error'}`,
        );
      }
    }
    return this.emailTemplateService.renderTemplate(id, variables);
  }
}
