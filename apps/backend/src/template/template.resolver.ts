import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Template } from './template.entity';
import { TemplateService } from './template.service';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
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
  getAllTemplates(): Template[] {
    return this.templateService.getAllTemplates();
  }

  @Query(() => Template, { description: 'Get a template by id' })
  getTemplate(@Args('id') id: string): Template {
    return this.templateService.getTemplateById(id);
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
