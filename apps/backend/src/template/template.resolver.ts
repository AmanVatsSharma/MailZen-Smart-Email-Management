import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { Template } from './entities/template.entity';
import { TemplateService } from './template.service';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { TemplateDataExportResponse } from './dto/template-data-export.response';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => Template)
@UseGuards(JwtAuthGuard)
export class TemplateResolver {
  constructor(private readonly templateService: TemplateService) {}

  @Query(() => [Template], { description: 'Get all templates' })
  async getAllTemplates(@Context() ctx: RequestContext): Promise<Template[]> {
    return this.templateService.getAllTemplates(ctx.req.user.id);
  }

  @Query(() => Template, { description: 'Get a template by id' })
  async getTemplate(
    @Args('id') id: string,
    @Context() ctx: RequestContext,
  ): Promise<Template> {
    return this.templateService.getTemplateById(id, ctx.req.user.id);
  }

  @Query(() => TemplateDataExportResponse, {
    description: 'Export current user template data as JSON payload',
  })
  async myTemplateDataExport(
    @Context() ctx: RequestContext,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<TemplateDataExportResponse> {
    return this.templateService.exportTemplateData({
      userId: ctx.req.user.id,
      limit: limit ?? null,
    });
  }

  @Query(() => TemplateDataExportResponse, {
    description:
      'Admin export of target user template data for legal/compliance workflows',
  })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  async userTemplateDataExport(
    @Args('userId') userId: string,
    @Context() ctx: RequestContext,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<TemplateDataExportResponse> {
    return this.templateService.exportTemplateDataForAdmin({
      targetUserId: userId,
      actorUserId: ctx.req.user.id,
      limit: limit ?? null,
    });
  }

  @Mutation(() => Template, { description: 'Create a new template' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  async createTemplate(
    @Args('createTemplateInput') createTemplateInput: CreateTemplateInput,
    @Context() ctx: RequestContext,
  ): Promise<Template> {
    return this.templateService.createTemplate(
      createTemplateInput,
      ctx.req.user.id,
    );
  }

  @Mutation(() => Template, { description: 'Update a template' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  async updateTemplate(
    @Args('updateTemplateInput') updateTemplateInput: UpdateTemplateInput,
    @Context() ctx: RequestContext,
  ): Promise<Template> {
    return this.templateService.updateTemplate(
      updateTemplateInput,
      ctx.req.user.id,
    );
  }

  @Mutation(() => Template, { description: 'Delete a template' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  async deleteTemplate(
    @Args('id') id: string,
    @Context() ctx: RequestContext,
  ): Promise<Template> {
    return this.templateService.deleteTemplate(id, ctx.req.user.id);
  }
}
