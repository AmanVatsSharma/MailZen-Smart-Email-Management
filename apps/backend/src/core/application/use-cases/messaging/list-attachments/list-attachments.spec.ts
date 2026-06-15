/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-attachments/list-attachments.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for ListAttachmentsHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { ListAttachmentsHandler } from './list-attachments.handler';
import { InMemoryAttachmentRepository } from '../../../../testing/in-memory-attachment.repository';
import { Attachment } from '../../../../domain/bounded-contexts/messaging/attachment.entity';
import { EmailId } from '../../../../domain/shared/value-objects/ids';

describe('ListAttachmentsHandler', () => {
  it('returns attachments for an email', async () => {
    const attachments = new InMemoryAttachmentRepository();
    const a = Attachment.create({
      id: 'a1',
      emailId: EmailId.from('33333333-3333-4333-8333-333333333333'),
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      size: 1024,
      storageKey: 'user/email/doc.pdf',
    });
    if (!a.ok) throw new Error('seed');
    await attachments.save(a.value);
    const handler = new ListAttachmentsHandler(attachments);

    const result = await handler.execute({ emailId: '33333333-3333-4333-8333-333333333333' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].filename).toBe('doc.pdf');
  });

  it('returns an empty list when no attachments exist', async () => {
    const handler = new ListAttachmentsHandler(new InMemoryAttachmentRepository());
    const result = await handler.execute({ emailId: '33333333-3333-4333-8333-333333333333' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(0);
  });
});
