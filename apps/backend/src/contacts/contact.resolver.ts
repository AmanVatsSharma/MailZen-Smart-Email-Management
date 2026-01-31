import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Contact } from './contact.entity';
import { ContactService } from './contact.service';
import { CreateContactInput } from './dto/create-contact.input';
import { UpdateContactInput } from './dto/update-contact.input';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => Contact)
@UseGuards(JwtAuthGuard)
export class ContactResolver {
  constructor(private readonly contactService: ContactService) {}

  @Query(() => [Contact], { description: 'Get all contacts for the current user' })
  async getAllContacts(@Context() context: RequestContext): Promise<Contact[]> {
    return this.contactService.getAllContacts(context.req.user.id);
  }

  @Query(() => Contact, { description: 'Get a contact by id' })
  async getContact(
    @Args('id') id: string,
    @Context() context: RequestContext
  ): Promise<Contact> {
    return this.contactService.getContactById(context.req.user.id, id);
  }

  @Mutation(() => Contact, { description: 'Create a new contact' })
  async createContact(
    @Args('createContactInput') createContactInput: CreateContactInput,
    @Context() context: RequestContext
  ): Promise<Contact> {
    return this.contactService.createContact(context.req.user.id, createContactInput);
  }
  
  @Mutation(() => Contact, { description: 'Update an existing contact' })
  async updateContact(
    @Args('updateContactInput') updateContactInput: UpdateContactInput,
    @Context() context: RequestContext
  ): Promise<Contact> {
    return this.contactService.updateContact(
      context.req.user.id,
      updateContactInput.id,
      {
        name: updateContactInput.name,
        email: updateContactInput.email,
        phone: updateContactInput.phone
      }
    );
  }
  
  @Mutation(() => Contact, { description: 'Delete a contact' })
  async deleteContact(
    @Args('id') id: string,
    @Context() context: RequestContext
  ): Promise<Contact> {
    return this.contactService.deleteContact(context.req.user.id, id);
  }
} 