import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feature } from './entities/feature.entity';
import { FeatureService } from './feature.service';
import { FeatureResolver } from './feature.resolver';

/**
 * FeatureModule - Feature flag management
 * Handles application feature toggles
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Feature]),
  ],
  providers: [FeatureService, FeatureResolver],
  exports: [FeatureService],
})
export class FeatureModule {}
