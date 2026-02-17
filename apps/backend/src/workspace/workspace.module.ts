import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { BillingModule } from '../billing/billing.module';
import { User } from '../user/entities/user.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceResolver } from './workspace.resolver';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, User, AuditLog]),
    BillingModule,
  ],
  providers: [WorkspaceService, WorkspaceResolver],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
