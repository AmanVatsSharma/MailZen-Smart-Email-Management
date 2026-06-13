// apps/backend/src/core/application/ports/persistence/unit-of-work.ts
// Port: transactional boundary. Infrastructure binds to TypeORM Transaction.

export const UNIT_OF_WORK = Symbol('IUnitOfWork');

export interface IUnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
