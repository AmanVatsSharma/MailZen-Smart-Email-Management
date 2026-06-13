// apps/backend/src/core/application/exceptions/application-error.ts
// Base class for application-layer errors. Translated to HTTP/GraphQL at the edge.

export class ApplicationError extends Error {
  readonly kind = 'ApplicationError' as const;
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, public readonly field?: string) {
    super('VALIDATION', message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(public readonly resource: string) {
    super('NOT_FOUND', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super('CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'unauthorized') {
    super('UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'forbidden') {
    super('FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}
