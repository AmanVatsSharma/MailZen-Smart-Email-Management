import { TemplateResolver } from './template.resolver';

describe('TemplateResolver', () => {
  const templateService = {
    getAllTemplates: jest.fn(),
    getTemplateById: jest.fn(),
    exportTemplateData: jest.fn(),
    exportTemplateDataForAdmin: jest.fn(),
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

  it('forwards actor to template data export queries', async () => {
    templateService.exportTemplateData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"summary":{"totalTemplates":1}}',
    });
    templateService.exportTemplateDataForAdmin.mockResolvedValue({
      generatedAtIso: '2026-02-16T01:00:00.000Z',
      dataJson: '{"summary":{"totalTemplates":2}}',
    });
    const context = {
      req: {
        user: {
          id: 'admin-3',
        },
      },
    } as never;

    const mine = await resolver.myTemplateDataExport(context, 80);
    const admin = await resolver.userTemplateDataExport('user-9', context, 120);

    expect(templateService.exportTemplateData).toHaveBeenCalledWith({
      userId: 'admin-3',
      limit: 80,
    });
    expect(templateService.exportTemplateDataForAdmin).toHaveBeenCalledWith({
      targetUserId: 'user-9',
      actorUserId: 'admin-3',
      limit: 120,
    });
    expect(mine.generatedAtIso).toBe('2026-02-16T00:00:00.000Z');
    expect(admin.generatedAtIso).toBe('2026-02-16T01:00:00.000Z');
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
