import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ContactService } from './contact.service';
import { Contact } from './entities/contact.entity';

describe('ContactService', () => {
  let service: ContactService;
  let contactRepo: jest.Mocked<Repository<Contact>>;

  const contact = {
    id: 'contact-1',
    userId: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Contact;

  beforeEach(async () => {
    const repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Contact>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: getRepositoryToken(Contact), useValue: repoMock },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
    contactRepo = module.get(getRepositoryToken(Contact));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates and saves a contact', async () => {
    contactRepo.create.mockReturnValue(contact);
    contactRepo.save.mockResolvedValue(contact);

    const result = await service.createContact('user-1', {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    });

    expect(contactRepo.create).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      userId: 'user-1',
    });
    expect(contactRepo.save).toHaveBeenCalledWith(contact);
    expect(result).toEqual(contact);
  });

  it('throws NotFoundException when contact is missing', async () => {
    contactRepo.findOne.mockResolvedValue(null);

    await expect(service.getContactById('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates and returns the refreshed contact', async () => {
    const updated = { ...contact, name: 'Updated Name' } as Contact;
    contactRepo.findOne
      .mockResolvedValueOnce(contact)
      .mockResolvedValueOnce(updated);
    contactRepo.update.mockResolvedValue({} as any);

    const result = await service.updateContact('user-1', contact.id, {
      name: 'Updated Name',
    });

    expect(contactRepo.update).toHaveBeenCalledWith(
      { id: contact.id },
      { name: 'Updated Name' },
    );
    expect(result).toEqual(updated);
  });

  it('deletes an existing contact and returns its last value', async () => {
    contactRepo.findOne.mockResolvedValue(contact);
    contactRepo.delete.mockResolvedValue({} as any);

    const result = await service.deleteContact('user-1', contact.id);

    expect(contactRepo.delete).toHaveBeenCalledWith({ id: contact.id });
    expect(result).toEqual(contact);
  });
});
