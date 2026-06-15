/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/attachment.entity.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     Attachment entity. Owned by an Email aggregate. Not an aggregate
 *              root — lifecycle is bound to its parent Email.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { Result, makeResult } from '../../shared/result';
import { EmailId } from '../../shared/value-objects/ids';

export interface AttachmentProps {
  id: string;
  emailId: EmailId;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}

export class Attachment {
  private constructor(private readonly props: AttachmentProps) {}

  static create(input: {
    id: string;
    emailId: EmailId;
    filename: string;
    contentType: string;
    size: number;
    storageKey: string;
  }): Result<Attachment, Error> {
    if (input.filename.trim().length === 0) {
      return makeResult(Result.err(new Error('filename is required')));
    }
    if (input.size < 0) {
      return makeResult(Result.err(new Error('size must be non-negative')));
    }
    return makeResult(Result.ok(new Attachment({
      id: input.id,
      emailId: input.emailId,
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      storageKey: input.storageKey,
      createdAt: new Date(),
    })));
  }

  static rehydrate(props: AttachmentProps): Attachment {
    return new Attachment(props);
  }

  get id(): string { return this.props.id; }
  get emailId(): EmailId { return this.props.emailId; }
  get filename(): string { return this.props.filename; }
  get contentType(): string { return this.props.contentType; }
  get size(): number { return this.props.size; }
  get storageKey(): string { return this.props.storageKey; }
}
