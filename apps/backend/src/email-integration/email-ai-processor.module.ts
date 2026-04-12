import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalEmailMessage } from './entities/external-email-message.entity';
import { EmailAiProcessorService } from './email-ai-processor.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalEmailMessage])],
  providers: [EmailAiProcessorService],
  exports: [EmailAiProcessorService],
})
export class EmailAiProcessorModule {}
