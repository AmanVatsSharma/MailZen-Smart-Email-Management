import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';
import { CreateFeatureInput } from './dto/create-feature.input';
import { UpdateFeatureInput } from './dto/update-feature.input';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Resolver(() => Feature)
@UseGuards(JwtAuthGuard)
export class FeatureResolver {
  constructor(private readonly featureService: FeatureService) {}

  @Query(() => [Feature], { description: 'Get all features' })
  getAllFeatures(): Feature[] {
    return this.featureService.getAllFeatures();
  }

  @Mutation(() => Feature, { description: 'Create a new feature' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  createFeature(@Args('createFeatureInput') createFeatureInput: CreateFeatureInput): Feature {
    return this.featureService.createFeature(createFeatureInput);
  }

  @Mutation(() => Feature, { description: 'Update a feature' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  updateFeature(@Args('updateFeatureInput') updateFeatureInput: UpdateFeatureInput): Feature {
    return this.featureService.updateFeature(updateFeatureInput);
  }

  @Mutation(() => Feature, { description: 'Delete a feature' })
  @SetMetadata('roles', ['ADMIN'])
  @UseGuards(AdminGuard)
  deleteFeature(@Args('id') id: string): Feature {
    return this.featureService.deleteFeature(id);
  }
} 