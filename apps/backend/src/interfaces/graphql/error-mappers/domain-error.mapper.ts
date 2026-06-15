// apps/backend/src/interfaces/graphql/error-mappers/domain-error.mapper.ts
// Single source of truth for translating ApplicationError -> GraphQL/HTTP error shape.

import { HttpException, HttpStatus } from '@nestjs/common';
import { ApplicationError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../core/application/exceptions/application-error';
import { Result } from '../../../core/domain/shared/result';

export interface GraphqlError {
  code: string;
  message: string;
  field?: string;
  retryable: boolean;
}

export const DomainErrorMapper = {
  toGraphql(e: ApplicationError): GraphqlError {
    const retryable = e.code === 'CONFLICT' ? false : e.code === 'NOT_FOUND' ? false : true;
    return {
      code: e.code,
      message: e.message,
      field: e instanceof ValidationError ? e.field : undefined,
      retryable,
    };
  },

  toHttpException(e: ApplicationError): HttpException {
    if (e instanceof ValidationError) return new HttpException({ code: e.code, message: e.message, field: e.field }, HttpStatus.BAD_REQUEST);
    if (e instanceof NotFoundError) return new HttpException({ code: e.code, message: e.message }, HttpStatus.NOT_FOUND);
    if (e instanceof ConflictError) return new HttpException({ code: e.code, message: e.message }, HttpStatus.CONFLICT);
    if (e instanceof UnauthorizedError) return new HttpException({ code: e.code, message: e.message }, HttpStatus.UNAUTHORIZED);
    if (e instanceof ForbiddenError) return new HttpException({ code: e.code, message: e.message }, HttpStatus.FORBIDDEN);
    return new HttpException({ code: e.code, message: e.message }, HttpStatus.INTERNAL_SERVER_ERROR);
  },

  map<T, R>(result: Result<T, ApplicationError>, ok: (value: T) => R): R | never {
    if (result.isOk()) return ok(result.unwrap());
    throw DomainErrorMapper.toHttpException(result.error);
  },
};
