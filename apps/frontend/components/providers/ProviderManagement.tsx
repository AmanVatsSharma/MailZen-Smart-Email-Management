'use client'
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Clock3,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProviderWizard } from './ProviderWizard';
import { EmailProvider, Provider } from '@/lib/providers/provider-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  GET_PROVIDERS, 
  DISCONNECT_PROVIDER, 
  UPDATE_PROVIDER, 
  SYNC_PROVIDER 
} from '@/lib/apollo/queries/providers';
import { GET_MY_INBOXES } from '@/lib/apollo/queries/inboxes';
import {
  GET_MY_MAILBOX_INBOUND_EVENTS,
  GET_MY_MAILBOX_INBOUND_EVENT_STATS,
} from '@/lib/apollo/queries/mailbox-observability';
import { gql } from '@apollo/client';

type MailboxObservabilityStatus = 'ACCEPTED' | 'DEDUPLICATED' | 'REJECTED';

type MailboxObservabilityEvent = {
  id: string;
  mailboxId: string;
  mailboxEmail?: string | null;
  messageId?: string | null;
  emailId?: string | null;
  inboundThreadKey?: string | null;
  status: MailboxObservabilityStatus;
  sourceIp?: string | null;
  signatureValidated: boolean;
  errorReason?: string | null;
  createdAt: string;
};

type MailboxObservabilityStats = {
  mailboxId?: string | null;
  mailboxEmail?: string | null;
  windowHours: number;
  totalCount: number;
  acceptedCount: number;
  deduplicatedCount: number;
  rejectedCount: number;
  lastProcessedAt?: string | null;
};

type InboxSource = {
  id: string;
  type: 'MAILBOX' | 'PROVIDER';
  address: string;
  isActive: boolean;
  status?: string | null;
};

const OBSERVABILITY_MAILBOX_ALL = 'ALL_MAILBOXES';
const OBSERVABILITY_EVENT_STATUS_ALL = 'ALL_STATUSES';

export function ProviderManagement() {
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [selectedMailboxId, setSelectedMailboxId] = useState(OBSERVABILITY_MAILBOX_ALL);
  const [selectedEventStatus, setSelectedEventStatus] = useState(
    OBSERVABILITY_EVENT_STATUS_ALL,
  );
  const [selectedWindowHours, setSelectedWindowHours] = useState('24');

  useEffect(() => {
    const storedWorkspaceId =
      typeof window !== 'undefined'
        ? localStorage.getItem('mailzen.selectedWorkspaceId')
        : null;
    setActiveWorkspaceId(storedWorkspaceId);
  }, []);

  // Fetch providers
  const { data, loading, error, refetch } = useQuery(GET_PROVIDERS, {
    variables: { workspaceId: activeWorkspaceId || undefined },
  });
  const providers = data?.providers || [];
  void loading;

  // Fetch MailZen mailbox list
  const { data: mailboxData, error: mailboxError } = useQuery(
    gql`
      query ProviderManagementMailboxes($workspaceId: String) {
        myMailboxes(workspaceId: $workspaceId)
      }
    `,
    {
      variables: { workspaceId: activeWorkspaceId || undefined },
    },
  );
  const mailzenBoxes: string[] = mailboxData?.myMailboxes || [];

  const { data: inboxData } = useQuery<{ myInboxes: InboxSource[] }>(GET_MY_INBOXES, {
    fetchPolicy: 'network-only',
  });

  const mailboxInboxes = useMemo(
    () =>
      (inboxData?.myInboxes || []).filter(
        (source) => source.type === 'MAILBOX',
      ) as InboxSource[],
    [inboxData?.myInboxes],
  );

  useEffect(() => {
    if (!mailboxInboxes.length) {
      if (selectedMailboxId !== OBSERVABILITY_MAILBOX_ALL) {
        setSelectedMailboxId(OBSERVABILITY_MAILBOX_ALL);
      }
      return;
    }

    const hasSelectedMailbox = mailboxInboxes.some(
      (mailbox) => mailbox.id === selectedMailboxId,
    );
    if (!hasSelectedMailbox && selectedMailboxId !== OBSERVABILITY_MAILBOX_ALL) {
      setSelectedMailboxId(OBSERVABILITY_MAILBOX_ALL);
    }
  }, [mailboxInboxes, selectedMailboxId]);

  const selectedMailboxFilter =
    selectedMailboxId === OBSERVABILITY_MAILBOX_ALL ? undefined : selectedMailboxId;
  const selectedStatusFilter =
    selectedEventStatus === OBSERVABILITY_EVENT_STATUS_ALL
      ? undefined
      : selectedEventStatus;
  const selectedStatsWindowHours = Number(selectedWindowHours) || 24;

  const {
    data: observabilityEventsData,
    loading: observabilityEventsLoading,
    error: observabilityEventsError,
    refetch: refetchObservabilityEvents,
  } = useQuery<{ myMailboxInboundEvents: MailboxObservabilityEvent[] }>(
    GET_MY_MAILBOX_INBOUND_EVENTS,
    {
      variables: {
        mailboxId: selectedMailboxFilter,
        workspaceId: activeWorkspaceId || undefined,
        status: selectedStatusFilter,
        limit: 25,
      },
      skip: mailboxInboxes.length === 0,
      fetchPolicy: 'network-only',
    },
  );

  const {
    data: observabilityStatsData,
    loading: observabilityStatsLoading,
    error: observabilityStatsError,
    refetch: refetchObservabilityStats,
  } = useQuery<{ myMailboxInboundEventStats: MailboxObservabilityStats }>(
    GET_MY_MAILBOX_INBOUND_EVENT_STATS,
    {
      variables: {
        mailboxId: selectedMailboxFilter,
        workspaceId: activeWorkspaceId || undefined,
        windowHours: selectedStatsWindowHours,
      },
      skip: mailboxInboxes.length === 0,
      fetchPolicy: 'network-only',
    },
  );

  const observabilityEvents =
    observabilityEventsData?.myMailboxInboundEvents || [];
  const observabilityStats = observabilityStatsData?.myMailboxInboundEventStats;

  // Mutations
  const [disconnectProvider, { loading: disconnectLoading }] = useMutation(DISCONNECT_PROVIDER, {
    onCompleted: () => {
      setIsConfirmingDelete(null);
      refetch();
    }
  });

  const [updateProvider] = useMutation(UPDATE_PROVIDER, {
    onCompleted: () => refetch()
  });

  const [syncProvider, { loading: syncLoading }] = useMutation(SYNC_PROVIDER, {
    onCompleted: () => refetch()
  });

  // Keep loading flags wired for future UX improvements; suppress unused-var lint for now.
  void disconnectLoading;
  void syncLoading;

  const { data: billingData } = useQuery(gql`
    query ProviderManagementBillingSnapshot {
      mySubscription {
        planCode
      }
      billingPlans {
        code
        name
        providerLimit
        mailboxLimit
        workspaceLimit
        aiCreditsPerMonth
      }
      myWorkspaces {
        id
      }
    }
  `);
  const myPlanCode = billingData?.mySubscription?.planCode || 'FREE';
  const planCatalog: Array<{
    code: string;
    name: string;
    providerLimit: number;
    mailboxLimit: number;
    workspaceLimit: number;
    aiCreditsPerMonth: number;
  }> = billingData?.billingPlans || [];
  const activePlan =
    planCatalog.find((plan) => plan.code === myPlanCode) ||
    planCatalog.find((plan) => plan.code === 'FREE');
  const usedProviderCount = providers.length;
  const usedMailboxCount = mailzenBoxes.length;
  const usedWorkspaceCount = Number(billingData?.myWorkspaces?.length || 0);

  // Add a new provider
  const openAddProviderDialog = () => {
    setIsAddingProvider(true);
  };

  const handleProviderConnected = () => {
    setIsAddingProvider(false);
    refetch();
  };

  // Remove a provider
  const handleRemoveProvider = (id: string) => {
    disconnectProvider({ variables: { id } });
  };

  // Toggle provider active status
  const handleToggleActive = (id: string, isActive: boolean) => {
    // Backend mutation is `updateProvider(id, isActive)`; pass explicit boolean.
    updateProvider({ variables: { id, isActive: !isActive } });
  };

  // Sync a provider
  const handleSync = (id: string) => {
    syncProvider({ variables: { id } });
  };

  // Get status badge for provider
  const getStatusBadge = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
        return (
          <Badge
            variant="outline"
            className="border-emerald-200/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge
            variant="outline"
            className="border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
          >
            Error
          </Badge>
        );
      case 'syncing':
        return (
          <Badge
            variant="outline"
            className="border-blue-200/60 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200"
          >
            Syncing...
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get provider icon
  const getProviderIcon = (type: EmailProvider) => {
    switch (type) {
      case 'gmail':
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <Mail className="h-5 w-5 text-red-600 dark:text-red-300" />
          </div>
        );
      case 'outlook':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
        );
      case 'smtp':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <Mail className="h-5 w-5 text-purple-600 dark:text-purple-300" />
          </div>
        );
      default:
        return null;
    }
  };

  const getObservabilityStatusBadge = (status: MailboxObservabilityStatus) => {
    if (status === 'ACCEPTED') {
      return (
        <Badge
          variant="outline"
          className="border-emerald-200/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          Accepted
        </Badge>
      );
    }
    if (status === 'DEDUPLICATED') {
      return (
        <Badge
          variant="outline"
          className="border-blue-200/60 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200"
        >
          Deduplicated
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
      >
        Rejected
      </Badge>
    );
  };

  const formatIsoDate = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const formatMessageIdentifier = (value?: string | null) => {
    if (!value) return 'n/a';
    return value.length > 42 ? `${value.slice(0, 39)}...` : value;
  };

  const handleRefreshObservability = async () => {
    if (mailboxInboxes.length === 0) return;
    await Promise.all([refetchObservabilityEvents(), refetchObservabilityStats()]);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Email Providers</h2>
        <Button onClick={openAddProviderDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add Provider
        </Button>
      </div>

      {activePlan && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  Current plan: {activePlan.name} ({activePlan.code})
                </p>
                <p className="text-xs text-muted-foreground">
                  Provider and mailbox limits are enforced by your subscription.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">
                  Providers: {usedProviderCount}/{activePlan.providerLimit}
                </Badge>
                <Badge variant="outline">
                  Mailboxes: {usedMailboxCount}/{activePlan.mailboxLimit}
                </Badge>
                <Badge variant="outline">
                  Workspaces: {usedWorkspaceCount}/{activePlan.workspaceLimit}
                </Badge>
                <Badge variant="outline">
                  AI credits/month: {activePlan.aiCreditsPerMonth}
                </Badge>
                <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                  <Link href="/settings/billing">Manage plan</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(error || mailboxError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load provider settings</AlertTitle>
          <AlertDescription>
            {error?.message || mailboxError?.message || 'Please refresh and try again.'}
          </AlertDescription>
        </Alert>
      )}

      {mailboxInboxes.length > 0 && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">Mailbox inbound observability</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track inbound delivery outcomes, signature validation, and replay deduplication
              for your MailZen aliases.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Select
                value={selectedMailboxId}
                onValueChange={(nextValue) => setSelectedMailboxId(nextValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mailbox scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OBSERVABILITY_MAILBOX_ALL}>
                    All mailboxes
                  </SelectItem>
                  {mailboxInboxes.map((mailbox) => (
                    <SelectItem key={mailbox.id} value={mailbox.id}>
                      {mailbox.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedEventStatus}
                onValueChange={(nextValue) => setSelectedEventStatus(nextValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OBSERVABILITY_EVENT_STATUS_ALL}>
                    All statuses
                  </SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="DEDUPLICATED">Deduplicated</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedWindowHours}
                onValueChange={(nextValue) => setSelectedWindowHours(nextValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">Last 24 hours</SelectItem>
                  <SelectItem value="72">Last 72 hours</SelectItem>
                  <SelectItem value="168">Last 7 days</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="justify-center gap-2"
                onClick={() => {
                  void handleRefreshObservability();
                }}
                disabled={observabilityEventsLoading || observabilityStatsLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    observabilityEventsLoading || observabilityStatsLoading
                      ? 'animate-spin'
                      : ''
                  }`}
                />
                Refresh telemetry
              </Button>
            </div>

            {(observabilityEventsError || observabilityStatsError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Telemetry query failed</AlertTitle>
                <AlertDescription>
                  {observabilityEventsError?.message ||
                    observabilityStatsError?.message ||
                    'Unable to load mailbox inbound telemetry right now.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Badge variant="outline" className="justify-center">
                Total: {observabilityStats?.totalCount ?? 0}
              </Badge>
              <Badge
                variant="outline"
                className="justify-center border-emerald-200/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                Accepted: {observabilityStats?.acceptedCount ?? 0}
              </Badge>
              <Badge
                variant="outline"
                className="justify-center border-blue-200/60 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200"
              >
                Deduplicated: {observabilityStats?.deduplicatedCount ?? 0}
              </Badge>
              <Badge
                variant="outline"
                className="justify-center border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
              >
                Rejected: {observabilityStats?.rejectedCount ?? 0}
              </Badge>
              <Badge variant="outline" className="justify-center">
                Window: {observabilityStats?.windowHours ?? selectedStatsWindowHours}h
              </Badge>
            </div>

            <div className="rounded-lg border">
              <div className="grid grid-cols-12 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-3">Mailbox</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Message-ID</div>
                <div className="col-span-2">Signed</div>
                <div className="col-span-2">Processed at</div>
              </div>
              <div className="divide-y">
                {observabilityEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-xs"
                  >
                    <div className="col-span-3">
                      <p className="truncate font-medium">
                        {event.mailboxEmail || event.mailboxId}
                      </p>
                      <p className="truncate text-muted-foreground">{event.sourceIp || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      {getObservabilityStatusBadge(event.status)}
                    </div>
                    <div className="col-span-3">
                      <p className="truncate">{formatMessageIdentifier(event.messageId)}</p>
                      {event.errorReason && (
                        <p className="truncate text-destructive">{event.errorReason}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Badge variant={event.signatureValidated ? 'default' : 'secondary'}>
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        {event.signatureValidated ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span className="truncate">{formatIsoDate(event.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {!observabilityEvents.length &&
                  !observabilityEventsLoading &&
                  !observabilityEventsError && (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No inbound telemetry events found for the selected filters.
                    </div>
                  )}

                {observabilityEventsLoading && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Loading inbound telemetry events...
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Last processed event:{' '}
              {formatIsoDate(observabilityStats?.lastProcessedAt || null)}
            </p>
          </CardContent>
        </Card>
      )}

      {providers.length === 0 && mailzenBoxes.length === 0 ? (
        <Card className="border-dashed border-2 p-6">
          <div className="text-center py-8">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Providers Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your email providers to start using MailZen&apos;s features
            </p>
            <Button onClick={openAddProviderDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add Provider
            </Button>
          </div>
        </Card>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4"
        >
          {mailzenBoxes.map((email: string) => (
            <motion.div key={`mailzen-${email}`} variants={itemVariants}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                      </div>
                      <div>
                        <h3 className="font-medium">MailZen Mailbox</h3>
                        <p className="text-sm text-muted-foreground">{email}</p>
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className="border-emerald-200/60 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                      >
                        Primary
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {providers.map((provider: Provider) => (
            <motion.div key={provider.id} variants={itemVariants}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getProviderIcon(provider.type)}
                      <div>
                        <h3 className="font-medium">{provider.name}</h3>
                        <p className="text-sm text-muted-foreground">{provider.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(provider.status)}
                      <div className="flex items-center ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(provider.id, provider.isActive)}
                        >
                          {provider.isActive ? (
                            <Settings className="h-4 w-4" />
                          ) : (
                            <Settings className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSync(provider.id)}
                          disabled={provider.status === 'syncing'}
                        >
                          <RefreshCw className={`h-4 w-4 ${provider.status === 'syncing' ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsConfirmingDelete(provider.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>
                        Last synced:{' '}
                        {provider.lastSynced
                          ? new Date(provider.lastSynced).toLocaleString()
                          : 'Never'}
                      </span>
                      <span>Status: {provider.isActive ? 'Active' : 'Paused'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Add Provider Dialog */}
      <Dialog open={isAddingProvider} onOpenChange={setIsAddingProvider}>
        <DialogContent className="sm:max-w-[800px]">
          <ProviderWizard 
            onComplete={handleProviderConnected}
            onCancel={() => setIsAddingProvider(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!isConfirmingDelete} onOpenChange={() => setIsConfirmingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Removal</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this email provider? 
              This will disconnect MailZen from accessing emails from this account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmingDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => isConfirmingDelete && handleRemoveProvider(isConfirmingDelete)}
            >
              Remove Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 