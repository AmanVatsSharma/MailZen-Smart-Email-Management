/**
 * File:        core/testing/fake-unit-of-work.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IUnitOfWork for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IUnitOfWork } from 'application/ports/persistence/unit-of-work';

export class FakeUnitOfWork implements IUnitOfWork {
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}