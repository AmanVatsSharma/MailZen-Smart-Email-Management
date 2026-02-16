import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Feature } from './entities/feature.entity';
import { FeatureService } from './feature.service';
import { FeatureResolver } from './feature.resolver';

/**
 * FeatureModule - Feature flag management
 * Handles application feature toggles
 */
@Module({
  imports: [TypeOrmModule.forFeature([Feature, AuditLog])],
  providers: [FeatureService, FeatureResolver],
  exports: [FeatureService],
})
export class FeatureModule {}
