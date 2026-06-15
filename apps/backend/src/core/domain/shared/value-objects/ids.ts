// apps/backend/src/core/domain/shared/value-objects/ids.ts
// Branded ID value objects. Type-safe, prevent ID mixups across contexts.

import { Result, makeResult } from '../result';

export type Brand<T, B> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type EmailId = Brand<string, 'EmailId'>;
export type ThreadId = Brand<string, 'ThreadId'>;
export type MailboxId = Brand<string, 'MailboxId'>;
export type PlanId = Brand<string, 'PlanId'>;
export type AutomationId = Brand<string, 'AutomationId'>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function brandedId<T extends string>(raw: string): Result<T, InvalidIdError> {
  if (!UUID_RE.test(raw)) {
    return makeResult(Result.err(new InvalidIdError(raw)));
  }
  return makeResult(Result.ok(raw as T));
}

export const UserId = {
  create: (raw: string) => brandedId<UserId>(raw),
  from: (raw: string) => raw as UserId, // trusted internal use
};
export const WorkspaceId = {
  create: (raw: string) => brandedId<WorkspaceId>(raw),
  from: (raw: string) => raw as WorkspaceId,
};
export const EmailId = {
  create: (raw: string) => brandedId<EmailId>(raw),
  from: (raw: string) => raw as EmailId,
};
export const ThreadId = {
  create: (raw: string) => brandedId<ThreadId>(raw),
  from: (raw: string) => raw as ThreadId,
};
export const MailboxId = {
  create: (raw: string) => brandedId<MailboxId>(raw),
  from: (raw: string) => raw as MailboxId,
};
export const PlanId = {
  create: (raw: string) => brandedId<PlanId>(raw),
  from: (raw: string) => raw as PlanId,
};
export const AutomationId = {
  create: (raw: string) => brandedId<AutomationId>(raw),
  from: (raw: string) => raw as AutomationId,
};

export class InvalidIdError extends Error {
  readonly kind = 'InvalidIdError' as const;
  constructor(public readonly input: string) {
    super(`Invalid ID (not a UUID): ${input}`);
    this.name = 'InvalidIdError';
  }
}
