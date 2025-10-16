'use client'
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, RefreshCw, Settings, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ProviderWizard } from './ProviderWizard';
import { EmailProvider, Provider, ProviderStatus } from '@/lib/providers/provider-utils';
import { 
  GET_EMAIL_PROVIDERS, 
  DISCONNECT_PROVIDER, 
  UPDATE_PROVIDER_STATUS, 
  SYNC_PROVIDER 
} from '@/lib/apollo/queries/providers';
import { gql } from '@apollo/client';

export function ProviderManagement() {
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);

  // Fetch providers
  const { data, loading, error, refetch } = useQuery(GET_EMAIL_PROVIDERS);
  const providers = data?.getEmailProviders || [];

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

  const [updateProviderStatus] = useMutation(UPDATE_PROVIDER_STATUS, {
    onCompleted: () => refetch()
  });

  const [syncProvider, { loading: syncLoading }] = useMutation(SYNC_PROVIDER, {
    onCompleted: () => refetch()
  });

  // Add a new provider
  const handleAddProvider = () => {
    setIsAddingProvider(true);
  };

  // Remove a provider
  const handleRemoveProvider = (id: string) => {
    disconnectProvider({ variables: { id } });
  };

  // Toggle provider active status
  const handleToggleActive = (id: string, isActive: boolean) => {
    updateProviderStatus({ variables: { id, isActive: !isActive } });
  };

  // Sync a provider
  const handleSync = (id: string) => {
    syncProvider({ variables: { id } });
  };

  // Get status badge for provider
  const getStatusBadge = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Connected</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Error</Badge>;
      case 'syncing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Syncing...</Badge>;
      default:
        return null;
    }
  };

  // Get provider icon
  const getProviderIcon = (type: EmailProvider) => {
    switch (type) {
      case 'gmail':
        return <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <Mail className="h-5 w-5 text-red-600" />
        </div>;
      case 'outlook':
        return <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Mail className="h-5 w-5 text-blue-600" />
        </div>;
      case 'smtp':
        return <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Mail className="h-5 w-5 text-purple-600" />
        </div>;
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
        <Button onClick={handleAddProvider}>
          <Plus className="mr-2 h-4 w-4" /> Add Provider
        </Button>
      </div>

      {providers.length === 0 && mailzenBoxes.length === 0 ? (
        <Card className="border-dashed border-2 p-6">
          <div className="text-center py-8">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Providers Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your email providers to start using MailZen's features
            </p>
            <Button onClick={handleAddProvider}>
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
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">MailZen Mailbox</h3>
                        <p className="text-sm text-muted-foreground">{email}</p>
                      </div>
                    </div>
                    <div>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Primary</Badge>
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
                      <span>Last synced: {new Date(provider.lastSynced).toLocaleString()}</span>
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
            onComplete={handleAddProvider}
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