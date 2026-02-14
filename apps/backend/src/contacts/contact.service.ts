import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { CreateContactInput } from './dto/create-contact.input';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
  ) {}

  async createContact(
    userId: string,
    createContactInput: CreateContactInput,
  ): Promise<Contact> {
    return this.contactRepo.save(
      this.contactRepo.create({
        name: createContactInput.name,
        email: createContactInput.email,
        phone: createContactInput.phone,
        userId,
      }),
    );
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

    await this.contactRepo.update({ id }, { ...updateData });
    return this.getContactById(userId, id);
  }

  async deleteContact(userId: string, id: string): Promise<Contact> {
    // Verify the contact exists and belongs to the user
    await this.getContactById(userId, id);

    const contact = await this.contactRepo.findOne({ where: { id, userId } });
    // If it existed in getContactById, it should exist here too; keep defensive anyway.
    if (!contact)
      throw new NotFoundException(`Contact with id ${id} not found`);
    await this.contactRepo.delete({ id });
    return contact;
  }
}
