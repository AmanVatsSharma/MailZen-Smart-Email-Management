import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(() => {
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    service = new TemplateService(auditLogRepo);
  });

  it('creates and lists templates', async () => {
    const created = await service.createTemplate(
      {
        name: 'Welcome',
        subject: 'Hello',
        body: 'Body',
      },
      'admin-1',
    );

    const allTemplates = service.getAllTemplates();

    expect(created.id).toEqual(expect.any(String));
    expect(created.name).toBe('Welcome');
    expect(allTemplates).toHaveLength(1);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'template_created',
      }),
    );
  });

  it('updates existing template fields', async () => {
    const created = await service.createTemplate({
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });

    const updated = await service.updateTemplate(
      {
        id: created.id,
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
    const created = await service.createTemplate({
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });

    const deleted = await service.deleteTemplate(created.id, 'admin-3');

    expect(deleted.id).toBe(created.id);
    expect(service.getAllTemplates()).toHaveLength(0);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-3',
        action: 'template_deleted',
      }),
    );
  });

  it('throws when template is missing', async () => {
    expect(() => service.getTemplateById('missing')).toThrow(NotFoundException);
    await expect(service.updateTemplate({ id: 'missing' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.deleteTemplate('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('continues creating template when audit log write fails', async () => {
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const created = await service.createTemplate(
      {
        name: 'Fallback',
        subject: 'Fallback',
        body: 'Body',
      },
      'admin-4',
    );

    expect(created.id).toEqual(expect.any(String));
    expect(created.name).toBe('Fallback');
  });
});
