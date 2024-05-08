import { Metadata } from 'next';
import { ProviderManagement } from '@/components/providers/ProviderManagement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Email Providers | MailZen',
  description: 'Connect and manage your email providers in MailZen',
};

interface EmailProvidersPageProps {
  searchParams?: {
    provider?: string;
    success?: string;
    error?: string;
    code?: string;
  };
}

export default function EmailProvidersPage({ searchParams }: EmailProvidersPageProps) {
  const { provider, success, error } = searchParams || {};
  
  // Determine if we have a success or error message to display
  const showSuccess = success === 'true' && provider;
  const showError = !!error;
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Email Providers</h1>
        <p className="text-muted-foreground">
          Connect and manage your email accounts from various providers
        </p>
      </div>
      
      {showSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
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
    </div>
  );
} 