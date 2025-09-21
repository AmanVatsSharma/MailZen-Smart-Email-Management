import { Injectable, NotFoundException } from '@nestjs/common';
// Prisma removed
import { Contact } from '@prisma/client';
import { CreateContactInput } from './dto/create-contact.input';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async createContact(userId: string, createContactInput: CreateContactInput): Promise<Contact> {
    return this.prisma.contact.create({
      data: {
        name: createContactInput.name,
        email: createContactInput.email,
        phone: createContactInput.phone,
        userId: userId
      }
    });
  }

  async getAllContacts(userId: string): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { userId }
    });
  }

  async getContactById(userId: string, id: string): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId }
    });
    
    if (!contact) {
      throw new NotFoundException(`Contact with id ${id} not found`);
    }
    
    return contact;
  }
  
  async updateContact(userId: string, id: string, updateData: Partial<CreateContactInput>): Promise<Contact> {
    // Verify the contact exists and belongs to the user
    await this.getContactById(userId, id);
    
    return this.prisma.contact.update({
      where: { id },
      data: updateData
    });
  }
  
  async deleteContact(userId: string, id: string): Promise<Contact> {
    // Verify the contact exists and belongs to the user
    await this.getContactById(userId, id);
    
    return this.prisma.contact.delete({
      where: { id }
    });
  }
} 