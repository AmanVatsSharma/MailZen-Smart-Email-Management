import { TemplateResolver } from './template.resolver';

describe('TemplateResolver', () => {
  const templateService = {
    getAllTemplates: jest.fn(),
    getTemplateById: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
  };

  const resolver = new TemplateResolver(templateService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards actor to template read queries', async () => {
    templateService.getAllTemplates.mockResolvedValue([
      {
        id: 'template-1',
        name: 'Welcome',
        subject: 'Hello',
        body: 'Body',
      },
    ]);
    templateService.getTemplateById.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });
    const context = {
      req: {
        user: {
          id: 'admin-1',
        },
      },
    } as never;

    const templates = await resolver.getAllTemplates(context);
    const template = await resolver.getTemplate('template-1', context);

    expect(templateService.getAllTemplates).toHaveBeenCalledWith('admin-1');
    expect(templateService.getTemplateById).toHaveBeenCalledWith(
      'template-1',
      'admin-1',
    );
    expect(templates).toHaveLength(1);
    expect(template).toEqual(
      expect.objectContaining({
        id: 'template-1',
      }),
    );
  });

  it('forwards actor to create template mutation', async () => {
    templateService.createTemplate.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });

    const result = await resolver.createTemplate(
      {
        name: 'Welcome',
        subject: 'Hello',
        body: 'Body',
      },
      {
        req: {
          user: {
            id: 'admin-1',
          },
        },
      } as never,
    );

    expect(templateService.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Welcome',
      }),
      'admin-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'template-1',
      }),
    );
  });

  it('forwards actor to update and delete template mutations', async () => {
    templateService.updateTemplate.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Updated',
      body: 'Body',
    });
    templateService.deleteTemplate.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Updated',
      body: 'Body',
    });

    const context = {
      req: {
        user: {
          id: 'admin-2',
        },
      },
    } as never;

    const updated = await resolver.updateTemplate(
      {
        id: 'template-1',
        subject: 'Updated',
      },
      context,
    );
    const deleted = await resolver.deleteTemplate('template-1', context);

    expect(templateService.updateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'template-1',
      }),
      'admin-2',
    );
    expect(templateService.deleteTemplate).toHaveBeenCalledWith(
      'template-1',
      'admin-2',
    );
    expect(updated).toEqual(
      expect.objectContaining({
        id: 'template-1',
      }),
    );
    expect(deleted).toEqual(
      expect.objectContaining({
        id: 'template-1',
      }),
    );
  });
});
