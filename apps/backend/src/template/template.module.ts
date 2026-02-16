import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Template } from './entities/template.entity';
import { TemplateService } from './template.service';
import { TemplateResolver } from './template.resolver';

/**
 * TemplateModule - Email template management
 * Handles reusable email templates
 */
@Module({
  imports: [TypeOrmModule.forFeature([Template, AuditLog])],
  providers: [TemplateService, TemplateResolver],
  exports: [TemplateService],
})
export class TemplateModule {}
