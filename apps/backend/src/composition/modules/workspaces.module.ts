// apps/backend/src/composition/modules/workspaces.module.ts
// Composition for the workspaces bounded context (workspaces, memberships, contacts).

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/workspace.orm-entity';
import { MembershipOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/membership.orm-entity';
import { ContactOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/contact.orm-entity';
import { TypeOrmWorkspaceRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmMembershipRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-membership.repository';
import { TypeOrmContactRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-contact.repository';
import { WORKSPACE_REPOSITORY } from '../../core/application/ports/repositories/workspace.repository';
import { MEMBERSHIP_REPOSITORY } from '../../core/application/ports/repositories/membership.repository';
import { CONTACT_REPOSITORY } from '../../core/application/ports/repositories/contact.repository';
import { CreateWorkspaceHandler } from '../../core/application/use-cases/workspaces/create-workspace/create-workspace.handler';
import { GetWorkspaceHandler } from '../../core/application/use-cases/workspaces/get-workspace/get-workspace.handler';
import { ListWorkspacesHandler } from '../../core/application/use-cases/workspaces/list-workspaces/list-workspaces.handler';
import { ArchiveWorkspaceHandler } from '../../core/application/use-cases/workspaces/archive-workspace/archive-workspace.handler';
import { AddMemberHandler } from '../../core/application/use-cases/workspaces/add-member/add-member.handler';
import { RemoveMemberHandler } from '../../core/application/use-cases/workspaces/remove-member/remove-member.handler';
import { ChangeMemberRoleHandler } from '../../core/application/use-cases/workspaces/change-member-role/change-member-role.handler';
import { CreateContactHandler } from '../../core/application/use-cases/contacts/create-contact/create-contact.handler';
import { UpdateContactHandler } from '../../core/application/use-cases/contacts/update-contact/update-contact.handler';
import { DeleteContactHandler } from '../../core/application/use-cases/contacts/delete-contact/delete-contact.handler';
import { GetContactHandler } from '../../core/application/use-cases/contacts/get-contact/get-contact.handler';
import { ListContactsHandler } from '../../core/application/use-cases/contacts/list-contacts/list-contacts.handler';
import { RenameWorkspaceHandler } from '../../core/application/use-cases/workspaces/rename-workspace/rename-workspace.handler';
import { TransferOwnershipHandler } from '../../core/application/use-cases/workspaces/transfer-ownership/transfer-ownership.handler';
import { ExportWorkspaceDataHandler } from '../../core/application/use-cases/workspaces/export-workspace-data/export-workspace-data.handler';
import { ListWorkspaceMembersHandler } from '../../core/application/use-cases/workspaces/list-workspace-members/list-workspace-members.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceOrmEntity, MembershipOrmEntity, ContactOrmEntity]),
  ],
  providers: [
    { provide: WORKSPACE_REPOSITORY, useClass: TypeOrmWorkspaceRepository },
    { provide: MEMBERSHIP_REPOSITORY, useClass: TypeOrmMembershipRepository },
    { provide: CONTACT_REPOSITORY, useClass: TypeOrmContactRepository },
    CreateWorkspaceHandler,
    GetWorkspaceHandler,
    ListWorkspacesHandler,
    ArchiveWorkspaceHandler,
    AddMemberHandler,
    RemoveMemberHandler,
    ChangeMemberRoleHandler,
    CreateContactHandler,
    UpdateContactHandler,
    DeleteContactHandler,
    GetContactHandler,
    ListContactsHandler,
    RenameWorkspaceHandler,
    TransferOwnershipHandler,
    ExportWorkspaceDataHandler,
    ListWorkspaceMembersHandler,
  ],
  exports: [
    WORKSPACE_REPOSITORY,
    MEMBERSHIP_REPOSITORY,
    CONTACT_REPOSITORY,
    TypeOrmModule,
  ],
})
export class WorkspacesModule {}
