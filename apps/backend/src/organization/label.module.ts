import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { LabelService } from './label.service';
import { LabelResolver } from './label.resolver';
import { EmailLabel } from '../email/entities/email-label.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLabel, AuditLog])],
  providers: [LabelService, LabelResolver],
  exports: [LabelService],
})
export class LabelModule {}
