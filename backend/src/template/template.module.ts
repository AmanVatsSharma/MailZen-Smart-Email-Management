import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateResolver } from './template.resolver';

@Module({
  providers: [TemplateService, TemplateResolver],
  exports: [TemplateService],
})
export class TemplateModule {} 