import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { ContactService } from './contact.service';
import { ContactResolver } from './contact.resolver';

/**
 * ContactModule - Contact management
 * Handles user contact book operations
 */
@Module({
  imports: [TypeOrmModule.forFeature([Contact])],
  providers: [ContactService, ContactResolver],
  exports: [ContactService],
})
export class ContactModule {}
