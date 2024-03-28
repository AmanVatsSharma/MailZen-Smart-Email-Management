import { Module } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { FeatureResolver } from './feature.resolver';

@Module({
  providers: [FeatureService, FeatureResolver],
  exports: [FeatureService],
})
export class FeatureModule {} 