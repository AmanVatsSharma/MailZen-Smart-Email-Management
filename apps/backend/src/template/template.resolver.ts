import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Template } from './template.entity';
import { TemplateService } from './template.service';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

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
  createTemplate(
    @Args('createTemplateInput') createTemplateInput: CreateTemplateInput,
  ): Template {
    return this.templateService.createTemplate(createTemplateInput);
  }

  @Mutation(() => Template, { description: 'Update a template' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  updateTemplate(
    @Args('updateTemplateInput') updateTemplateInput: UpdateTemplateInput,
  ): Template {
    return this.templateService.updateTemplate(updateTemplateInput);
  }

  @Mutation(() => Template, { description: 'Delete a template' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  deleteTemplate(@Args('id') id: string): Template {
    return this.templateService.deleteTemplate(id);
  }
}
