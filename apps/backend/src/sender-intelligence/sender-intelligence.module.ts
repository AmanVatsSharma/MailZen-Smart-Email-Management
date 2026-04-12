import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SenderProfile } from './entities/sender-profile.entity';
import { SenderIntelligenceService } from './sender-intelligence.service';
import { SenderIntelligenceResolver } from './sender-intelligence.resolver';

@Module({
  imports: [TypeOrmModule.forFeature([SenderProfile])],
  providers: [SenderIntelligenceService, SenderIntelligenceResolver],
  exports: [SenderIntelligenceService],
})
export class SenderIntelligenceModule {}
