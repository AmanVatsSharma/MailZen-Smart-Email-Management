import { Injectable, NotFoundException } from '@nestjs/common';
import { Feature } from './feature.entity';
import { CreateFeatureInput } from './dto/create-feature.input';
import { UpdateFeatureInput } from './dto/update-feature.input';

@Injectable()
export class FeatureService {
  private features: Feature[] = [];
  private idCounter = 1;

  createFeature(input: CreateFeatureInput): Feature {
    const feature: Feature = {
      id: String(this.idCounter++),
      name: input.name,
      isActive: input.isActive,
    };
    this.features.push(feature);
    return feature;
  }

  getAllFeatures(): Feature[] {
    return this.features;
  }

  getFeatureById(id: string): Feature {
    const feature = this.features.find(f => f.id === id);
    if (!feature) {
      throw new NotFoundException(`Feature with id ${id} not found`);
    }
    return feature;
  }

  updateFeature(input: UpdateFeatureInput): Feature {
    const feature = this.getFeatureById(input.id);
    if (input.name !== undefined) {
      feature.name = input.name;
    }
    if (input.isActive !== undefined) {
      feature.isActive = input.isActive;
    }
    return feature;
  }

  deleteFeature(id: string): Feature {
    const index = this.features.findIndex(f => f.id === id);
    if (index === -1) {
      throw new NotFoundException(`Feature with id ${id} not found`);
    }
    const [deleted] = this.features.splice(index, 1);
    return deleted;
  }
} 