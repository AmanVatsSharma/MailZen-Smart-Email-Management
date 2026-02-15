import { Metadata } from 'next';
import { ProviderManagement } from '@/components/providers/ProviderManagement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';

export const metadata: Metadata = {
  title: 'Email Providers | MailZen',
  description:
    'Connect and manage providers, MailZen aliases, and inbound observability telemetry in MailZen',
};

interface EmailProvidersPageProps {
  searchParams?: Promise<{
    provider?: string;
    success?: string;
    error?: string;
  }>;
}

export default async function EmailProvidersPage({ searchParams }: EmailProvidersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { provider, success, error } = resolvedSearchParams;
  
  // Determine if we have a success or error message to display
  const showSuccess = success === 'true' && provider;
  const showError = !!error;
  
  return (
    <DashboardPageShell
      title="Email Providers"
      description="Connect and manage providers, MailZen aliases, and inbound delivery telemetry."
      contentClassName="space-y-6"
    >
      {showSuccess && (
        <Alert
          variant="default"
          className="border-emerald-200/60 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-50"
        >
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>
            Your {provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'email'} account 
            has been successfully connected.
          </AlertDescription>
        </Alert>
      )}
      
      {showError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {decodeURIComponent(error)}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 gap-6">
        <ProviderManagement />
      </div>
    </DashboardPageShell>
  );
} 