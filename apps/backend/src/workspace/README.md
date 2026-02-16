# Workspace Module

## Goal

Provide a foundational multi-tenant workspace/team model for future RBAC and
organization features.

## Responsibilities

- Create and list user workspaces
- Auto-provision personal workspace for each user
- Track workspace members with role and invitation status
- Enforce membership access checks for member listing/invites
- Enforce billing entitlement limits for workspace count
- Enforce billing entitlement limits for active members per workspace
- Provide default workspace context for newly created providers/mailboxes

## GraphQL Surface

- `myWorkspaces`: list workspaces for authenticated user
- `myActiveWorkspace`: current active workspace for authenticated user
- `myWorkspaceDataExport(workspaceId)`: export workspace + membership snapshot JSON
- `createWorkspace(name)`: create team workspace
- `setActiveWorkspace(workspaceId)`: persist active workspace
- `workspaceMembers(workspaceId)`: list members for workspace
- `inviteWorkspaceMember(workspaceId, email, role?)`: add/invite a member
- `myPendingWorkspaceInvitations`: list pending invites for authenticated user email
- `respondWorkspaceInvitation(workspaceMemberId, accept)`: accept/decline invite
- `updateWorkspaceMemberRole(workspaceMemberId, role)`: OWNER/ADMIN role management
- `removeWorkspaceMember(workspaceMemberId)`: remove member with owner safety guardrails

## Data Model

- `workspaces`
  - owner, slug, personal/team indicator
- `workspace_members`
  - workspace membership, role, status, invited-by metadata
  - supports `pending` / `active` / `declined` invitation lifecycle

## Observability

- Structured service warning event:
  - `workspace_member_limit_reached`
  - `workspace_audit_log_write_failed`

## Compliance / Audit Trail

Workspace mutation flows now persist `audit_logs` entries for:

- `workspace_created`
- `workspace_member_invited`
- `workspace_invitation_responded`
- `workspace_member_role_updated`
- `workspace_member_removed`
- `workspace_active_set`
- `workspace_data_export_requested`

## Flow

```mermaid
flowchart TD
  A[User creates workspace] --> B[Ensure personal workspace exists]
  B --> C[Create workspace row]
  C --> D[Create OWNER membership]
  D --> E[Workspace visible in myWorkspaces]

  F[Invite member] --> G[Verify actor role OWNER/ADMIN]
  G --> G1[Enforce active-member seat limit for workspace]
  G1 --> H[Resolve existing user by email]
  H --> I[Create membership active/pending]

  J[User checks pending invitations] --> K[Filter memberships by user email and status pending]
  K --> L[respondWorkspaceInvitation]
  L --> M[Enforce seat limit on accept then set status active or declined + attach userId]

  N[Admin updates member role] --> O[Enforce OWNER-only owner promotion]
  O --> P[Prevent demoting last OWNER]
  P --> Q[Persist normalized role]

  R[Admin removes member] --> S[Enforce owner removal safeguards]
  S --> T[Set membership status removed]
```
