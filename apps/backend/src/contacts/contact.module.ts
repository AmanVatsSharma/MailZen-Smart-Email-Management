import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Contact } from './entities/contact.entity';
import { ContactService } from './contact.service';
import { ContactResolver } from './contact.resolver';

/**
 * ContactModule - Contact management
 * Handles user contact book operations
 */
@Module({
  imports: [TypeOrmModule.forFeature([Contact, AuditLog])],
  providers: [ContactService, ContactResolver],
  exports: [ContactService],
})
export class ContactModule {}
