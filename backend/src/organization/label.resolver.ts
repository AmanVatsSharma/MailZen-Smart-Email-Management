import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Label } from './label.entity';
import { LabelService } from './label.service';
import { CreateLabelInput } from './dto/create-label.input';

@Resolver(() => Label)
@UseGuards(JwtAuthGuard)
export class LabelResolver {
  constructor(private readonly labelService: LabelService) {}

  @Query(() => [Label], { description: 'Get all labels' })
  getAllLabels(): Label[] {
    return this.labelService.getAllLabels();
  }

  @Query(() => Label, { description: 'Get a label by id' })
  getLabel(@Args('id') id: string): Label {
    return this.labelService.getLabelById(id);
  }

  @Mutation(() => Label, { description: 'Create a new label' })
  createLabel(@Args('createLabelInput') createLabelInput: CreateLabelInput): Label {
    return this.labelService.createLabel(createLabelInput);
  }
} 