import { gql } from '@apollo/client';

export const GET_MY_WORKSPACES = gql`
  query GetMyWorkspaces {
    myWorkspaces {
      id
      name
      slug
      isPersonal
      createdAt
    }
  }
`;

export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($name: String!) {
    createWorkspace(name: $name) {
      id
      name
      slug
      isPersonal
      createdAt
    }
  }
`;

export const GET_WORKSPACE_MEMBERS = gql`
  query GetWorkspaceMembers($workspaceId: String!) {
    workspaceMembers(workspaceId: $workspaceId) {
      id
      workspaceId
      email
      role
      status
      invitedByUserId
      createdAt
    }
  }
`;

export const INVITE_WORKSPACE_MEMBER = gql`
  mutation InviteWorkspaceMember(
    $workspaceId: String!
    $email: String!
    $role: String
  ) {
    inviteWorkspaceMember(workspaceId: $workspaceId, email: $email, role: $role) {
      id
      email
      role
      status
    }
  }
`;

