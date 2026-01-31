import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PhoneService } from './phone.service';
import { PhoneResolver } from './phone.resolver';

@Module({
  imports: [PrismaModule],
  providers: [PhoneService, PhoneResolver],
  exports: [PhoneService],
})
export class PhoneModule {}
