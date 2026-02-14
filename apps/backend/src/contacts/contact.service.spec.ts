import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CreateContactInput } from './dto/create-contact.input';

describe('ContactService', () => {
  let service: ContactService;
  let prismaService: PrismaService;

  // Mock contact data
  const mockContact = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock PrismaService
  const mockPrismaService = {
    contact: {
      create: jest.fn().mockResolvedValue(mockContact),
      findMany: jest.fn().mockResolvedValue([mockContact]),
      findFirst: jest.fn().mockResolvedValue(mockContact),
      update: jest
        .fn()
        .mockResolvedValue({ ...mockContact, name: 'Updated Name' }),
      delete: jest.fn().mockResolvedValue(mockContact),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createContact', () => {
    it('should create a new contact', async () => {
      // Arrange
      const userId = 'user-1';
      const createContactInput: CreateContactInput = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      };

      // Act
      const result = await service.createContact(userId, createContactInput);

      // Assert
      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: {
          name: createContactInput.name,
          email: createContactInput.email,
          phone: createContactInput.phone,
          userId,
        },
      });
      expect(result).toEqual(mockContact);
    });
  });

  describe('getAllContacts', () => {
    it('should return all contacts for a user', async () => {
      // Arrange
      const userId = 'user-1';

      // Act
      const result = await service.getAllContacts(userId);

      // Assert
      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual([mockContact]);
    });
  });

  describe('getContactById', () => {
    it('should return a contact by id', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = '1';

      // Act
      const result = await service.getContactById(userId, contactId);

      // Assert
      expect(prismaService.contact.findFirst).toHaveBeenCalledWith({
        where: { id: contactId, userId },
      });
      expect(result).toEqual(mockContact);
    });

    it('should throw NotFoundException when contact not found', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = 'non-existent';
      jest
        .spyOn(prismaService.contact, 'findFirst')
        .mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.getContactById(userId, contactId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.contact.findFirst).toHaveBeenCalledWith({
        where: { id: contactId, userId },
      });
    });
  });

  describe('updateContact', () => {
    it('should update a contact', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = '1';
      const updateData = { name: 'Updated Name' };

      // Act
      const result = await service.updateContact(userId, contactId, updateData);

      // Assert
      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: contactId },
        data: updateData,
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should verify contact exists before updating', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = '1';
      const updateData = { name: 'Updated Name' };
      const getContactByIdSpy = jest.spyOn(service, 'getContactById');

      // Act
      await service.updateContact(userId, contactId, updateData);

      // Assert
      expect(getContactByIdSpy).toHaveBeenCalledWith(userId, contactId);
    });

    it('should throw NotFoundException when contact not found', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = 'non-existent';
      const updateData = { name: 'Updated Name' };
      jest
        .spyOn(service, 'getContactById')
        .mockRejectedValueOnce(
          new NotFoundException(`Contact with id ${contactId} not found`),
        );

      // Act & Assert
      await expect(
        service.updateContact(userId, contactId, updateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteContact', () => {
    it('should delete a contact', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = '1';

      // Act
      const result = await service.deleteContact(userId, contactId);

      // Assert
      expect(prismaService.contact.delete).toHaveBeenCalledWith({
        where: { id: contactId },
      });
      expect(result).toEqual(mockContact);
    });

    it('should verify contact exists before deleting', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = '1';
      const getContactByIdSpy = jest.spyOn(service, 'getContactById');

      // Act
      await service.deleteContact(userId, contactId);

      // Assert
      expect(getContactByIdSpy).toHaveBeenCalledWith(userId, contactId);
    });

    it('should throw NotFoundException when contact not found', async () => {
      // Arrange
      const userId = 'user-1';
      const contactId = 'non-existent';
      jest
        .spyOn(service, 'getContactById')
        .mockRejectedValueOnce(
          new NotFoundException(`Contact with id ${contactId} not found`),
        );

      // Act & Assert
      await expect(service.deleteContact(userId, contactId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
