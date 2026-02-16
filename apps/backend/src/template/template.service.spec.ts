import { NotFoundException } from '@nestjs/common';
import { TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    service = new TemplateService();
  });

  it('creates and lists templates', () => {
    const created = service.createTemplate({
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });

    const allTemplates = service.getAllTemplates();

    expect(created.id).toEqual(expect.any(String));
    expect(created.name).toBe('Welcome');
    expect(allTemplates).toHaveLength(1);
  });

  it('updates existing template fields', () => {
    const created = service.createTemplate({
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });

    const updated = service.updateTemplate({
      id: created.id,
      subject: 'Updated subject',
    });

    expect(updated.subject).toBe('Updated subject');
    expect(updated.name).toBe('Welcome');
  });

  it('deletes template by id', () => {
    const created = service.createTemplate({
      name: 'Welcome',
      subject: 'Hello',
      body: 'Body',
    });

    const deleted = service.deleteTemplate(created.id);

    expect(deleted.id).toBe(created.id);
    expect(service.getAllTemplates()).toHaveLength(0);
  });

  it('throws when template is missing', () => {
    expect(() => service.getTemplateById('missing')).toThrow(NotFoundException);
    expect(() => service.updateTemplate({ id: 'missing' })).toThrow(
      NotFoundException,
    );
    expect(() => service.deleteTemplate('missing')).toThrow(NotFoundException);
  });
});
