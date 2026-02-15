import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Mail, AlertCircle } from 'lucide-react';
import { useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  EmailProvider, 
  SmtpSettings, 
  validateSmtpSettings,
  getGoogleOAuthUrl,
  getMicrosoftOAuthUrl
} from '@/lib/providers/provider-utils';
import { CONNECT_SMTP } from '@/lib/apollo/queries/providers';

// Step types
type WizardStep = 'provider-select' | 'connect' | 'configure' | 'success';

interface ProviderWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function ProviderWizard({ onComplete, onCancel }: ProviderWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('provider-select');
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    smtp: SmtpSettings;
  }>({
    smtp: {
      host: '',
      port: '',
      username: '',
      password: '',
      secure: true,
    }
  });
  const [connectSmtp, { loading: smtpConnecting }] = useMutation(CONNECT_SMTP, {
    onError: (error) => {
      setConnectionError(error.message || 'SMTP connection failed');
    },
  });

  // Calculate progress percentage based on current step
  const getProgressPercentage = () => {
    switch (currentStep) {
      case 'provider-select': return 25;
      case 'connect': return 50;
      case 'configure': return 75;
      case 'success': return 100;
      default: return 0;
    }
  };

  // Handle provider selection
  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider);
    setCurrentStep('connect');
  };

  // Handle OAuth connection
  const handleOAuthConnect = (provider: 'gmail' | 'outlook') => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Backend-only OAuth flow:
      // - We redirect to backend start endpoint.
      // - Backend handles OAuth provider redirect + callback + DB write.
      // - Backend redirects back here with success/error query params.
      const url =
        provider === 'gmail'
          ? getGoogleOAuthUrl('/email-providers')
          : getMicrosoftOAuthUrl('/email-providers');
      window.location.href = url;
    } catch {
      setConnectionError('Failed to initiate OAuth flow. Please try again.');
      setIsConnecting(false);
    }
  };

  // Handle SMTP connection
  const handleSmtpConnect = () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    // Validate SMTP settings
    const validation = validateSmtpSettings(formData.smtp);
    
    if (!validation.valid) {
      setConnectionError(validation.message || 'Invalid SMTP settings');
      setIsConnecting(false);
      return;
    }
    
    connectSmtp({
      variables: {
        settings: {
          email: formData.smtp.username,
          host: formData.smtp.host,
          port: Number(formData.smtp.port),
          username: formData.smtp.username,
          password: formData.smtp.password,
          secure: formData.smtp.secure,
        },
      },
    })
      .then(() => {
        setCurrentStep('success');
      })
      .catch(() => {
        // handled in onError
      })
      .finally(() => {
        setIsConnecting(false);
      });
  };

  // Handle completion
  const handleComplete = () => {
    onComplete();
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
    },
    exit: {
      opacity: 0,
      transition: { when: "afterChildren" }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Connect Email Provider</CardTitle>
        <CardDescription>
          Connect your email accounts to use MailZen&apos;s powerful features
        </CardDescription>
        <Progress value={getProgressPercentage()} className="h-2 mt-2" />
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {currentStep === 'provider-select' && (
            <motion.div
              key="provider-select"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4"
            >
              <h3 className="text-lg font-medium">Select your email provider</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div variants={itemVariants}>
                  <Button
                    variant="outline"
                    className="w-full h-32 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                    onClick={() => handleProviderSelect('gmail')}
                  >
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-red-600" />
                    </div>
                    <span className="font-medium">Gmail</span>
                  </Button>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button
                    variant="outline"
                    className="w-full h-32 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                    onClick={() => handleProviderSelect('outlook')}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="font-medium">Outlook</span>
                  </Button>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button
                    variant="outline"
                    className="w-full h-32 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                    onClick={() => handleProviderSelect('smtp')}
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-purple-600" />
                    </div>
                    <span className="font-medium">Custom SMTP</span>
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentStep === 'connect' && (
            <motion.div
              key="connect"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6"
            >
              <motion.div variants={itemVariants}>
                <h3 className="text-lg font-medium mb-4">
                  Connect to {selectedProvider === 'gmail' ? 'Gmail' : 
                              selectedProvider === 'outlook' ? 'Outlook' : 'Custom SMTP'}
                </h3>

                {selectedProvider === 'gmail' && (
                  <div className="text-center py-6">
                    <p className="mb-6">
                      You&apos;ll be redirected to Google to authorize MailZen.
                      We only request the permissions needed to manage your emails.
                    </p>
                    
                    {connectionError && (
                      <div className="flex items-center gap-2 text-red-500 mb-4 p-3 bg-red-50 rounded-md">
                        <AlertCircle className="h-5 w-5" />
                        <p>{connectionError}</p>
                      </div>
                    )}
                    
                    <Button 
                      onClick={() => handleOAuthConnect('gmail')} 
                      disabled={isConnecting}
                      className="w-full md:w-auto"
                    >
                      {isConnecting ? 'Connecting...' : 'Authorize with Google'}
                    </Button>
                  </div>
                )}

                {selectedProvider === 'outlook' && (
                  <div className="text-center py-6">
                    <p className="mb-6">
                      You&apos;ll be redirected to Microsoft to authorize MailZen.
                      We only request the permissions needed to manage your emails.
                    </p>
                    
                    {connectionError && (
                      <div className="flex items-center gap-2 text-red-500 mb-4 p-3 bg-red-50 rounded-md">
                        <AlertCircle className="h-5 w-5" />
                        <p>{connectionError}</p>
                      </div>
                    )}
                    
                    <Button 
                      onClick={() => handleOAuthConnect('outlook')} 
                      disabled={isConnecting}
                      className="w-full md:w-auto"
                    >
                      {isConnecting ? 'Connecting...' : 'Authorize with Microsoft'}
                    </Button>
                  </div>
                )}

                {selectedProvider === 'smtp' && (
                  <div className="py-4">
                    <p className="mb-6">
                      Enter your SMTP server details to connect your email account.
                    </p>
                    
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      handleSmtpConnect();
                    }} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="host" className="text-sm font-medium">SMTP Host</label>
                          <input
                            id="host"
                            type="text"
                            value={formData.smtp.host}
                            onChange={(e) => setFormData({
                              ...formData,
                              smtp: { ...formData.smtp, host: e.target.value }
                            })}
                            className="w-full p-2 border rounded-md"
                            placeholder="smtp.example.com"
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="port" className="text-sm font-medium">SMTP Port</label>
                          <input
                            id="port"
                            type="text"
                            value={formData.smtp.port}
                            onChange={(e) => setFormData({
                              ...formData,
                              smtp: { ...formData.smtp, port: e.target.value }
                            })}
                            className="w-full p-2 border rounded-md"
                            placeholder="587"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-medium">Username</label>
                        <input
                          id="username"
                          type="text"
                          value={formData.smtp.username}
                          onChange={(e) => setFormData({
                            ...formData,
                            smtp: { ...formData.smtp, username: e.target.value }
                          })}
                          className="w-full p-2 border rounded-md"
                          placeholder="your.email@example.com"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                        <input
                          id="password"
                          type="password"
                          value={formData.smtp.password}
                          onChange={(e) => setFormData({
                            ...formData,
                            smtp: { ...formData.smtp, password: e.target.value }
                          })}
                          className="w-full p-2 border rounded-md"
                          required
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          id="secure"
                          type="checkbox"
                          checked={formData.smtp.secure}
                          onChange={(e) => setFormData({
                            ...formData,
                            smtp: { ...formData.smtp, secure: e.target.checked }
                          })}
                          className="rounded"
                        />
                        <label htmlFor="secure" className="text-sm font-medium">Use secure connection (TLS)</label>
                      </div>
                      
                      {connectionError && (
                        <div className="flex items-center gap-2 text-red-500 p-3 bg-red-50 rounded-md">
                          <AlertCircle className="h-5 w-5" />
                          <p>{connectionError}</p>
                        </div>
                      )}
                      
                      <Button 
                        type="submit" 
                        disabled={isConnecting || smtpConnecting}
                        className="w-full md:w-auto"
                      >
                        {isConnecting || smtpConnecting ? 'Connecting...' : 'Connect SMTP Server'}
                      </Button>
                    </form>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {currentStep === 'success' && (
            <motion.div
              key="success"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="text-center py-6 space-y-6"
            >
              <motion.div 
                variants={itemVariants}
                className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
              >
                <Check className="h-8 w-8 text-green-600" />
              </motion.div>
              
              <motion.h3 variants={itemVariants} className="text-xl font-medium">
                Successfully Connected!
              </motion.h3>
              
              <motion.p variants={itemVariants} className="text-muted-foreground">
                Your {selectedProvider === 'gmail' ? 'Gmail' : 
                      selectedProvider === 'outlook' ? 'Outlook' : 'SMTP'} account has been 
                successfully connected to MailZen.
              </motion.p>
              
              <motion.div variants={itemVariants}>
                <Button onClick={handleComplete} className="mt-4">
                  Continue to Dashboard
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      <CardFooter className="flex justify-between">
        {currentStep !== 'provider-select' && currentStep !== 'success' && (
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep('provider-select')}
          >
            Back
          </Button>
        )}
        {currentStep === 'provider-select' && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <div></div> {/* Spacer */}
      </CardFooter>
    </Card>
  );
}