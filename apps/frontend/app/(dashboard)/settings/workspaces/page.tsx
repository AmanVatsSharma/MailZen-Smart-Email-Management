'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Plus, RefreshCw, UserPlus, Users } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  CREATE_WORKSPACE,
  GET_MY_ACTIVE_WORKSPACE,
  GET_MY_WORKSPACES,
  GET_WORKSPACE_MEMBERS,
  INVITE_WORKSPACE_MEMBER,
  SET_ACTIVE_WORKSPACE,
} from '@/lib/apollo/queries/workspaces';

type Workspace = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  createdAt: string;
};

type WorkspaceMember = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

const WorkspaceSettingsPage = () => {
  const { toast } = useToast();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );

  const {
    data: workspaceData,
    loading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspaces,
  } = useQuery(GET_MY_WORKSPACES, {
    fetchPolicy: 'network-only',
    onCompleted: (payload) => {
      const firstWorkspaceId = payload?.myWorkspaces?.[0]?.id;
      if (!selectedWorkspaceId && firstWorkspaceId) setSelectedWorkspaceId(firstWorkspaceId);
    },
  });
  const { data: activeWorkspaceData, refetch: refetchActiveWorkspace } = useQuery(
    GET_MY_ACTIVE_WORKSPACE,
    {
      fetchPolicy: 'cache-and-network',
    },
  );

  const [createWorkspace, { loading: creatingWorkspace }] = useMutation(
    CREATE_WORKSPACE,
    {
      onCompleted: async (payload) => {
        await refetchWorkspaces();
        const createdWorkspaceId = payload?.createWorkspace?.id;
        if (createdWorkspaceId) setSelectedWorkspaceId(createdWorkspaceId);
        setNewWorkspaceName('');
        toast({
          title: 'Workspace created',
          description: 'New workspace is ready for team collaboration.',
        });
      },
    },
  );

  const {
    data: membersData,
    loading: membersLoading,
    refetch: refetchMembers,
  } = useQuery(GET_WORKSPACE_MEMBERS, {
    variables: { workspaceId: selectedWorkspaceId || '' },
    skip: !selectedWorkspaceId,
    fetchPolicy: 'network-only',
  });

  const [inviteWorkspaceMember, { loading: invitingMember }] = useMutation(
    INVITE_WORKSPACE_MEMBER,
    {
      onCompleted: async () => {
        await refetchMembers();
        setInviteEmail('');
        toast({
          title: 'Member invited',
          description: 'Workspace member invite has been recorded.',
        });
      },
    },
  );
  const [setActiveWorkspace, { loading: settingActiveWorkspace }] = useMutation(
    SET_ACTIVE_WORKSPACE,
    {
      onCompleted: async () => {
        await Promise.all([refetchActiveWorkspace(), refetchWorkspaces()]);
      },
    },
  );

  const workspaces: Workspace[] = workspaceData?.myWorkspaces || [];
  const members: WorkspaceMember[] = membersData?.workspaceMembers || [];
  const activeWorkspaceId: string | undefined = activeWorkspaceData?.myActiveWorkspace?.id;
  const selectedWorkspace = workspaces.find(
    (workspace) => workspace.id === selectedWorkspaceId,
  );

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    await createWorkspace({ variables: { name: newWorkspaceName.trim() } });
  };

  const handleInvite = async () => {
    if (!selectedWorkspaceId || !inviteEmail.trim()) return;
    await inviteWorkspaceMember({
      variables: {
        workspaceId: selectedWorkspaceId,
        email: inviteEmail.trim(),
        role: inviteRole,
      },
    });
  };

  const handleSelectWorkspace = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    await setActiveWorkspace({ variables: { workspaceId } });
  };

  return (
    <DashboardPageShell
      title="Workspace & Team Settings"
      description="Create workspaces, review members, and invite collaborators."
      contentClassName="max-w-5xl space-y-6"
    >
      <Alert className="border-primary/20 bg-primary/5">
        <Users className="h-4 w-4 text-primary" />
        <AlertTitle>Workspace RBAC foundation</AlertTitle>
        <AlertDescription>
          This is the first collaboration layer to support multi-team MailZen
          deployments.
        </AlertDescription>
      </Alert>

      {workspaceError && (
        <p className="text-sm text-destructive">
          Failed to load workspaces: {workspaceError.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create workspace</CardTitle>
          <CardDescription>
            Team workspaces separate billing, inbox ownership, and automation
            boundaries.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={newWorkspaceName}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            placeholder="e.g. Revenue Ops, Customer Success"
            className="max-w-md"
          />
          <Button
            disabled={creatingWorkspace || workspaceLoading}
            onClick={handleCreateWorkspace}
          >
            {creatingWorkspace ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My workspaces</CardTitle>
            <CardDescription>
              Select workspace to inspect members and manage invites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => handleSelectWorkspace(workspace.id)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  workspace.id === selectedWorkspaceId
                    ? 'border-primary/60 bg-primary/5'
                    : 'hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{workspace.name}</p>
                  <div className="flex items-center gap-1">
                    {workspace.isPersonal && <Badge variant="outline">Personal</Badge>}
                    {workspace.id === activeWorkspaceId && <Badge>Active</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">slug: {workspace.slug}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace members</CardTitle>
            <CardDescription>
              {selectedWorkspace
                ? `Members for ${selectedWorkspace.name}`
                : 'Select a workspace to manage members'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedWorkspace && (
              <div className="flex flex-wrap gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  className="max-w-xs"
                />
                <Input
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value.toUpperCase())}
                  placeholder="MEMBER"
                  className="max-w-[140px]"
                />
                <Button disabled={invitingMember} onClick={handleInvite}>
                  {invitingMember ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite
                    </>
                  )}
                </Button>
              </div>
            )}

            {membersLoading && (
              <p className="text-xs text-muted-foreground">Loading members...</p>
            )}
            {settingActiveWorkspace && (
              <p className="text-xs text-muted-foreground">Updating active workspace...</p>
            )}

            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div>
                  <p className="text-sm font-medium">{member.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(member.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{member.role}</Badge>
                  <Badge>{member.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardPageShell>
  );
};

export default WorkspaceSettingsPage;

