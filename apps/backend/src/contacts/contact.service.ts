import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import {
  fingerprintIdentifier,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { Contact } from './entities/contact.entity';
import { CreateContactInput } from './dto/create-contact.input';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'contact_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  async createContact(
    userId: string,
    createContactInput: CreateContactInput,
  ): Promise<Contact> {
    const createdContact = await this.contactRepo.save(
      this.contactRepo.create({
        name: createContactInput.name,
        email: createContactInput.email,
        phone: createContactInput.phone,
        userId,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'contact_created',
      metadata: {
        contactId: createdContact.id,
        emailFingerprint: fingerprintIdentifier(createdContact.email),
        phoneFingerprint: createdContact.phone
          ? fingerprintIdentifier(createdContact.phone)
          : null,
      },
    });
    return createdContact;
  }

  async getAllContacts(userId: string): Promise<Contact[]> {
    return this.contactRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getContactById(userId: string, id: string): Promise<Contact> {
    const contact = await this.contactRepo.findOne({ where: { id, userId } });

    if (!contact) {
      throw new NotFoundException(`Contact with id ${id} not found`);
    }

    return contact;
  }

  async updateContact(
    userId: string,
    id: string,
    updateData: Partial<CreateContactInput>,
  ): Promise<Contact> {
    // Verify the contact exists and belongs to the user
    await this.getContactById(userId, id);
    const changedFields = Object.entries(updateData)
      .filter(([, value]) => typeof value !== 'undefined')
      .map(([key]) => key)
      .sort();

    await this.contactRepo.update({ id }, { ...updateData });
    const updatedContact = await this.getContactById(userId, id);
    await this.writeAuditLog({
      userId,
      action: 'contact_updated',
      metadata: {
        contactId: updatedContact.id,
        changedFields,
        emailFingerprint: fingerprintIdentifier(updatedContact.email),
        phoneFingerprint: updatedContact.phone
          ? fingerprintIdentifier(updatedContact.phone)
          : null,
      },
    });
    return updatedContact;
  }

  async deleteContact(userId: string, id: string): Promise<Contact> {
    // Verify the contact exists and belongs to the user
    await this.getContactById(userId, id);

    const contact = await this.contactRepo.findOne({ where: { id, userId } });
    // If it existed in getContactById, it should exist here too; keep defensive anyway.
    if (!contact)
      throw new NotFoundException(`Contact with id ${id} not found`);
    await this.contactRepo.delete({ id });
    await this.writeAuditLog({
      userId,
      action: 'contact_deleted',
      metadata: {
        contactId: contact.id,
        emailFingerprint: fingerprintIdentifier(contact.email),
        phoneFingerprint: contact.phone
          ? fingerprintIdentifier(contact.phone)
          : null,
      },
    });
    return contact;
  }
}
