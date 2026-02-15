import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module';
import { User } from '../user/entities/user.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceResolver } from './workspace.resolver';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, User]),
    BillingModule,
  ],
  providers: [WorkspaceService, WorkspaceResolver],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
