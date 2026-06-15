/**
 * File:        apps/backend/src/core/domain/bounded-contexts/messaging/thread.aggregate.ts
 * Module:      Core · Domain · Messaging
 * Purpose:     Thread aggregate. Groups related emails into a single conversation
 *              and tracks participants + last activity time.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { AggregateRoot } from '../../shared/aggregate-root';
import { Result, makeResult } from '../../shared/result';
import { EmailAddress } from '../../shared/value-objects/email-address';
import { ThreadId, WorkspaceId } from '../../shared/value-objects/ids';
import { Email, EmailStatus } from './email.aggregate';

export interface ThreadProps {
  id: ThreadId;
  workspaceId: WorkspaceId;
  subject: string;
  participants: EmailAddress[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Thread extends AggregateRoot<ThreadProps> {
  private constructor(props: ThreadProps) {
    super(props);
  }

  static create(input: {
    id: ThreadId;
    workspaceId: WorkspaceId;
    subject: string;
    seed: Email;
  }): Result<Thread, Error> {
    if (input.subject.trim().length === 0) {
      return makeResult(Result.err(new Error('thread subject is required')));
    }
    const seedParticipants = [input.seed.from, ...input.seed.recipients];
    const thread = new Thread({
      id: input.id,
      workspaceId: input.workspaceId,
      subject: input.subject,
      participants: dedupeAddresses(seedParticipants),
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return makeResult(Result.ok(thread));
  }

static reconstitute(props: ThreadProps): Thread { return Thread.rehydrate(props); }
  static rehydrate(threadprops: ThreadProps): Thread {
    return new Thread(props);
  }

  addMessage(email: Email): void {
    if (email.status === EmailStatus.Sent) {
      this.props.lastMessageAt = new Date();
    }
    this.props.participants = dedupeAddresses([
      ...this.props.participants,
      email.from,
      ...email.recipients,
    ]);
    this.props.updatedAt = new Date();
  }

  get subject(): string { return this.props.subject; }
  get lastMessageAt(): Date { return this.props.lastMessageAt; }
  get participants(): ReadonlyArray<EmailAddress> { return this.props.participants; }
}

function dedupeAddresses(addrs: EmailAddress[]): EmailAddress[] {
  const seen = new Set<string>();
  const out: EmailAddress[] = [];
  for (const a of addrs) {
    const key = a.toString();
    if (!seen.has(key)) { seen.add(key); out.push(a); }
  }
  return out;
}
