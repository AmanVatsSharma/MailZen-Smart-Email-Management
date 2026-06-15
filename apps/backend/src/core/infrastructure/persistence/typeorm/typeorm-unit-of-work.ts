// apps/backend/src/core/infrastructure/persistence/typeorm/typeorm-unit-of-work.ts
// Adapter: implements IUnitOfWork with TypeORM's QueryRunner.

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IUnitOfWork } from '../../application/ports/persistence/unit-of-work';

@Injectable()
export class TypeOrmUnitOfWork implements IUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async () => work());
  }
}
