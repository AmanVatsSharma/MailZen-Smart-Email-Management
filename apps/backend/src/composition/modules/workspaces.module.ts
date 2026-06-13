// apps/backend/src/composition/modules/workspaces.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/workspace.orm-entity';
import { MembershipOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/membership.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceOrmEntity, MembershipOrmEntity])],
  exports: [TypeOrmModule],
})
export class WorkspacesModule {}
