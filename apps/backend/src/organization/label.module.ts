import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelService } from './label.service';
import { LabelResolver } from './label.resolver';
import { EmailLabel } from '../email/entities/email-label.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLabel])],
  providers: [LabelService, LabelResolver],
  exports: [LabelService],
})
export class LabelModule {}
