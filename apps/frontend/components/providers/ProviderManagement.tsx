'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Trash2, RefreshCw, Settings, Mail } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProviderWizard } from './ProviderWizard';
import { EmailProvider, Provider } from '@/lib/providers/provider-utils';
import { 
  GET_PROVIDERS, 
  DISCONNECT_PROVIDER, 
  UPDATE_PROVIDER, 
  SYNC_PROVIDER 
} from '@/lib/apollo/queries/providers';
import { gql } from '@apollo/client';

export function ProviderManagement() {
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);

  // Fetch providers
  const { data, loading, error, refetch } = useQuery(GET_PROVIDERS);
  const providers = data?.providers || [];
  void loading;
  void error;

  // Fetch MailZen mailbox list
  const { data: mailboxData } = useQuery(gql`{ myMailboxes }`);
  const mailzenBoxes: string[] = mailboxData?.myMailboxes || [];

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
        aiCreditsPerMonth
      }
    }
  `);
  const myPlanCode = billingData?.mySubscription?.planCode || 'FREE';
  const planCatalog: Array<{
    code: string;
    name: string;
    providerLimit: number;
    mailboxLimit: number;
    aiCreditsPerMonth: number;
  }> = billingData?.billingPlans || [];
  const activePlan =
    planCatalog.find((plan) => plan.code === myPlanCode) ||
    planCatalog.find((plan) => plan.code === 'FREE');
  const usedProviderCount = providers.length;
  const usedMailboxCount = mailzenBoxes.length;

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