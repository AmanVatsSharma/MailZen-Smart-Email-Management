import {
  BadRequestException,
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
      targetType: this.normalizeTargetType(input.targetType),
      targetValue: this.normalizeTargetValue(input.targetValue),
      rolloutPercentage: this.normalizeRolloutPercentage(
        input.rolloutPercentage,
      ),
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
    if (input.targetType !== undefined) {
      feature.targetType = this.normalizeTargetType(input.targetType);
    }
    if (input.targetValue !== undefined) {
      feature.targetValue = this.normalizeTargetValue(input.targetValue);
    }
    if (input.rolloutPercentage !== undefined) {
      feature.rolloutPercentage = this.normalizeRolloutPercentage(
        input.rolloutPercentage,
      );
    }
    return this.featureRepo.save(feature);
  }

  async deleteFeature(id: string): Promise<Feature> {
    const feature = await this.getFeatureById(id);
    await this.featureRepo.remove(feature);
    return feature;
  }

  async isFeatureEnabledForContext(input: {
    name: string;
    userId: string;
    workspaceId?: string | null;
  }): Promise<boolean> {
    const feature = await this.featureRepo.findOne({
      where: {
        name: input.name,
        isActive: true,
      },
    });
    if (!feature) return false;
    return this.matchesFeatureTarget({
      feature,
      userId: input.userId,
      workspaceId: input.workspaceId || null,
    });
  }

  private matchesFeatureTarget(input: {
    feature: Feature;
    userId: string;
    workspaceId: string | null;
  }): boolean {
    const targetType = this.normalizeTargetType(input.feature.targetType);
    const targetValue = this.normalizeTargetValue(input.feature.targetValue);
    const rolloutPercentage = this.normalizeRolloutPercentage(
      input.feature.rolloutPercentage,
    );
    if (rolloutPercentage <= 0) return false;

    if (targetType === 'GLOBAL') {
      return this.matchesRolloutBucket({
        userId: input.userId,
        rolloutPercentage,
        salt: input.feature.name,
      });
    }
    if (targetType === 'ENVIRONMENT') {
      const runtimeEnvironment = String(process.env.NODE_ENV || '').trim();
      if (!targetValue) return false;
      return (
        runtimeEnvironment.toLowerCase() === targetValue.toLowerCase() &&
        this.matchesRolloutBucket({
          userId: input.userId,
          rolloutPercentage,
          salt: input.feature.name,
        })
      );
    }
    if (targetType === 'WORKSPACE') {
      if (!targetValue || !input.workspaceId) return false;
      return (
        input.workspaceId === targetValue &&
        this.matchesRolloutBucket({
          userId: input.userId,
          rolloutPercentage,
          salt: input.feature.name,
        })
      );
    }
    if (targetType === 'USER') {
      if (!targetValue) return false;
      return input.userId === targetValue;
    }
    if (targetType === 'COHORT') {
      return this.matchesRolloutBucket({
        userId: input.userId,
        rolloutPercentage,
        salt: `${input.feature.name}:${targetValue || 'default'}`,
      });
    }
    return false;
  }

  private matchesRolloutBucket(input: {
    userId: string;
    rolloutPercentage: number;
    salt: string;
  }): boolean {
    if (input.rolloutPercentage >= 100) return true;
    const hashInput = `${input.salt}:${input.userId}`;
    let hashValue = 0;
    for (let idx = 0; idx < hashInput.length; idx += 1) {
      hashValue = (hashValue << 5) - hashValue + hashInput.charCodeAt(idx);
      hashValue |= 0;
    }
    const bucket = Math.abs(hashValue) % 100;
    return bucket < input.rolloutPercentage;
  }

  private normalizeTargetType(rawValue?: string): string {
    const normalized = String(rawValue || 'GLOBAL')
      .trim()
      .toUpperCase();
    if (
      normalized === 'GLOBAL' ||
      normalized === 'ENVIRONMENT' ||
      normalized === 'WORKSPACE' ||
      normalized === 'USER' ||
      normalized === 'COHORT'
    ) {
      return normalized;
    }
    throw new BadRequestException(
      'targetType must be one of GLOBAL, ENVIRONMENT, WORKSPACE, USER, COHORT',
    );
  }

  private normalizeTargetValue(rawValue?: string | null): string | null {
    const normalized = String(rawValue || '').trim();
    return normalized || null;
  }

  private normalizeRolloutPercentage(rawValue?: number): number {
    if (rawValue === undefined || rawValue === null) return 100;
    if (!Number.isFinite(rawValue)) return 100;
    const normalized = Math.floor(rawValue);
    if (normalized < 0) return 0;
    if (normalized > 100) return 100;
    return normalized;
  }
}
