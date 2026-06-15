/**
 * File:        apps/backend/src/core/application/use-cases/messaging/get-attachment/get-attachment.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for GetAttachmentHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { GetAttachmentHandler } from './get-attachment.handler';
import { InMemoryAttachmentRepository } from '../../../../testing/in-memory-attachment.repository';
import { Attachment } from '../../../../domain/bounded-contexts/messaging/attachment.entity';
import { EmailId } from '../../../../domain/shared/value-objects/ids';

describe('GetAttachmentHandler', () => {
  it('returns a stored attachment', async () => {
    const attachments = new InMemoryAttachmentRepository();
    const a = Attachment.create({
      id: 'a1', emailId: EmailId.from('33333333-3333-4333-8333-333333333333'),
      filename: 'pic.png', contentType: 'image/png', size: 2048, storageKey: 'k',
    });
    if (!a.ok) throw new Error('seed');
    await attachments.save(a.value);
    const handler = new GetAttachmentHandler(attachments);

    const result = await handler.execute({ id: 'a1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.filename).toBe('pic.png');
  });

  it('returns NotFoundError when attachment does not exist', async () => {
    const handler = new GetAttachmentHandler(new InMemoryAttachmentRepository());
    const result = await handler.execute({ id: 'nope' });
    expect(result.ok).toBe(false);
  });
});
