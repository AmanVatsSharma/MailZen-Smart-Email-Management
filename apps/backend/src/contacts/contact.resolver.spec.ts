import { Test, TestingModule } from '@nestjs/testing';
import { ContactResolver } from './contact.resolver';
import { ContactService } from './contact.service';
import { CreateContactInput } from './dto/create-contact.input';
import { UpdateContactInput } from './dto/update-contact.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

describe('ContactResolver', () => {
  let resolver: ContactResolver;
  let service: ContactService;

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

  // Mock context with user info
  const mockContext = {
    req: {
      user: {
        id: 'user-1',
      },
    },
  };

  // Mock ContactService
  const mockContactService = {
    createContact: jest.fn().mockResolvedValue(mockContact),
    getAllContacts: jest.fn().mockResolvedValue([mockContact]),
    getContactById: jest.fn().mockResolvedValue(mockContact),
    updateContact: jest
      .fn()
      .mockResolvedValue({ ...mockContact, name: 'Updated Name' }),
    deleteContact: jest.fn().mockResolvedValue(mockContact),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactResolver,
        { provide: ContactService, useValue: mockContactService },
        // Resolver uses @UseGuards(JwtAuthGuard); include guard deps so TestingModule can compile.
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: {
            validateToken: jest
              .fn()
              .mockReturnValue({ id: mockContext.req.user.id }),
          },
        },
      ],
    }).compile();

    resolver = module.get<ContactResolver>(ContactResolver);
    service = module.get<ContactService>(ContactService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('getAllContacts', () => {
    it('should return all contacts for the authenticated user', async () => {
      // Act
      const result = await resolver.getAllContacts(mockContext);

      // Assert
      expect(service.getAllContacts).toHaveBeenCalledWith(
        mockContext.req.user.id,
      );
      expect(result).toEqual([mockContact]);
    });
  });

  describe('getContact', () => {
    it('should return a contact by id', async () => {
      // Arrange
      const contactId = '1';

      // Act
      const result = await resolver.getContact(contactId, mockContext);

      // Assert
      expect(service.getContactById).toHaveBeenCalledWith(
        mockContext.req.user.id,
        contactId,
      );
      expect(result).toEqual(mockContact);
    });
  });

  describe('createContact', () => {
    it('should create a new contact', async () => {
      // Arrange
      const createContactInput: CreateContactInput = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      };

      // Act
      const result = await resolver.createContact(
        createContactInput,
        mockContext,
      );

      // Assert
      expect(service.createContact).toHaveBeenCalledWith(
        mockContext.req.user.id,
        createContactInput,
      );
      expect(result).toEqual(mockContact);
    });
  });

  describe('updateContact', () => {
    it('should update an existing contact', async () => {
      // Arrange
      const updateContactInput: UpdateContactInput = {
        id: '1',
        name: 'Updated Name',
      };

      // Act
      const result = await resolver.updateContact(
        updateContactInput,
        mockContext,
      );

      // Assert
      expect(service.updateContact).toHaveBeenCalledWith(
        mockContext.req.user.id,
        updateContactInput.id,
        {
          name: updateContactInput.name,
          email: updateContactInput.email,
          phone: updateContactInput.phone,
        },
      );
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteContact', () => {
    it('should delete a contact', async () => {
      // Arrange
      const contactId = '1';

      // Act
      const result = await resolver.deleteContact(contactId, mockContext);

      // Assert
      expect(service.deleteContact).toHaveBeenCalledWith(
        mockContext.req.user.id,
        contactId,
      );
      expect(result).toEqual(mockContact);
    });
  });
});
