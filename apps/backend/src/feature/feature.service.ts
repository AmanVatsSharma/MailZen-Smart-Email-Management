import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feature } from './entities/feature.entity';
import { CreateFeatureInput } from './dto/create-feature.input';
import { UpdateFeatureInput } from './dto/update-feature.input';

@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,
  ) {}

  async createFeature(input: CreateFeatureInput): Promise<Feature> {
    const existing = await this.featureRepo.findOne({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictException(
        `Feature with name '${input.name}' already exists`,
      );
    }

    const feature = this.featureRepo.create({
      name: input.name,
      isActive: input.isActive,
    });
    return this.featureRepo.save(feature);
  }

  async getAllFeatures(): Promise<Feature[]> {
    return this.featureRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getFeatureById(id: string): Promise<Feature> {
    const feature = await this.featureRepo.findOne({ where: { id } });
    if (!feature) {
      throw new NotFoundException(`Feature with id ${id} not found`);
    }
    return feature;
  }

  async updateFeature(input: UpdateFeatureInput): Promise<Feature> {
    const feature = await this.getFeatureById(input.id);
    if (input.name !== undefined) {
      feature.name = input.name;
    }
    if (input.isActive !== undefined) {
      feature.isActive = input.isActive;
    }
    return this.featureRepo.save(feature);
  }

  async deleteFeature(id: string): Promise<Feature> {
    const feature = await this.getFeatureById(id);
    await this.featureRepo.remove(feature);
    return feature;
  }
}
