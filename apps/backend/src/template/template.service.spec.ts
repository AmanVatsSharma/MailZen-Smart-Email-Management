import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Template } from './entities/template.entity';
import { TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;
  let templateRepo: jest.Mocked<Repository<Template>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    templateRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<Repository<Template>>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    service = new TemplateService(templateRepo, auditLogRepo);
  });

  it('creates and lists user-scoped templates', async () => {
    templateRepo.create.mockImplementation(
      (payload: Partial<Template>) => payload as Template,
    );
    templateRepo.save.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
      userId: 'admin-1',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
      updatedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as Template);
    templateRepo.find.mockResolvedValue([
      {
        id: 'template-1',
        name: 'Welcome',
        subject: 'Hello',
        body: 'Body',
        userId: 'admin-1',
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T00:00:00.000Z'),
      } as Template,
    ]);

    const created = await service.createTemplate(
      {
        name: 'Welcome',
        subject: 'Hello',
        body: 'Body',
      },
      'admin-1',
    );

    const allTemplates = await service.getAllTemplates('admin-1');

    expect(created.id).toBe('template-1');
    expect(created.name).toBe('Welcome');
    expect(allTemplates).toHaveLength(1);
    expect(templateRepo.find).toHaveBeenCalledWith({
      where: { userId: 'admin-1' },
      order: { updatedAt: 'DESC' },
    });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'template_created',
      }),
    );
  });

  it('updates existing template fields', async () => {
    templateRepo.findOne.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
      userId: 'admin-2',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
      updatedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as Template);
    templateRepo.save.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Updated subject',
      body: 'Body',
      userId: 'admin-2',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
      updatedAt: new Date('2026-02-16T00:00:01.000Z'),
    } as Template);

    const updated = await service.updateTemplate(
      {
        id: 'template-1',
        subject: 'Updated subject',
      },
      'admin-2',
    );

    expect(updated.subject).toBe('Updated subject');
    expect(updated.name).toBe('Welcome');
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-2',
        action: 'template_updated',
        metadata: expect.objectContaining({
          changedFields: ['subject'],
        }),
      }),
    );
  });

  it('deletes template by id', async () => {
    templateRepo.findOne.mockResolvedValue({
      id: 'template-9',
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
      userId: 'admin-3',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
      updatedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as Template);
    templateRepo.remove.mockResolvedValue({
      id: 'template-9',
    } as Template);
    templateRepo.find.mockResolvedValue([]);

    const deleted = await service.deleteTemplate('template-9', 'admin-3');

    expect(deleted.id).toBe('template-9');
    await expect(service.getAllTemplates('admin-3')).resolves.toEqual([]);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-3',
        action: 'template_deleted',
      }),
    );
  });

  it('throws when template is missing', async () => {
    templateRepo.findOne.mockResolvedValue(null);

    await expect(service.getTemplateById('missing', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.updateTemplate({ id: 'missing' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
    await expect(service.deleteTemplate('missing', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('continues creating template when audit log write fails', async () => {
    templateRepo.create.mockImplementation(
      (payload: Partial<Template>) => payload as Template,
    );
    templateRepo.save.mockResolvedValue({
      id: 'template-2',
      name: 'Fallback',
      subject: 'Fallback',
      body: 'Body',
      userId: 'admin-4',
      createdAt: new Date('2026-02-16T00:00:00.000Z'),
      updatedAt: new Date('2026-02-16T00:00:00.000Z'),
    } as Template);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const created = await service.createTemplate(
      {
        name: 'Fallback',
        subject: 'Fallback',
        body: 'Body',
      },
      'admin-4',
    );

    expect(created.id).toBe('template-2');
    expect(created.name).toBe('Fallback');
  });

  it('exports user-scoped template data snapshot', async () => {
    templateRepo.find.mockResolvedValue([
      {
        id: 'template-31',
        name: 'Onboarding',
        subject: 'Welcome',
        body: 'Hello team',
        userId: 'user-1',
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
        updatedAt: new Date('2026-02-16T01:00:00.000Z'),
      } as Template,
    ]);

    const exported = await service.exportTemplateData({
      userId: 'user-1',
      limit: 999,
    });
    const payload = JSON.parse(exported.dataJson) as {
      summary: { totalTemplates: number };
      templates: Array<{ id: string }>;
    };

    expect(payload.summary.totalTemplates).toBe(1);
    expect(payload.templates[0]?.id).toBe('template-31');
    expect(templateRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 500,
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'template_data_export_requested',
      }),
    );
  });

  it('exports target user template data for admin legal workflows', async () => {
    templateRepo.find.mockResolvedValue([]);

    const exported = await service.exportTemplateDataForAdmin({
      targetUserId: 'user-9',
      actorUserId: 'admin-9',
      limit: 80,
    });

    expect(exported.generatedAtIso).toBeTruthy();
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-9',
        action: 'template_data_export_requested',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-9',
        action: 'template_data_export_requested_by_admin',
        metadata: expect.objectContaining({
          targetUserId: 'user-9',
        }),
      }),
    );
  });

  it('does not fail admin template export when admin audit write fails', async () => {
    templateRepo.find.mockResolvedValue([]);
    auditLogRepo.save
      .mockResolvedValueOnce({ id: 'audit-log-1' } as AuditLog)
      .mockRejectedValueOnce(new Error('audit datastore unavailable'));

    const exported = await service.exportTemplateDataForAdmin({
      targetUserId: 'user-9',
      actorUserId: 'admin-9',
      limit: 20,
    });

    expect(exported.generatedAtIso).toBeTruthy();
    expect(exported.dataJson).toContain('"templates"');
  });

  it('rejects operations when actor user id is missing', async () => {
    await expect(
      service.createTemplate(
        {
          name: 'NoActor',
          subject: 'NoActor',
          body: 'NoActor',
        },
        '',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getAllTemplates('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.getTemplateById('template-1', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.exportTemplateDataForAdmin({
        targetUserId: 'user-9',
        actorUserId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
