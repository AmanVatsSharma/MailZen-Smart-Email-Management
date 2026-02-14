'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useMutation } from '@apollo/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FORGOT_PASSWORD_MUTATION } from '@/modules/auth';

// Define the form schema with Zod
const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Form type from schema
type FormValues = z.infer<typeof formSchema>;

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Set up form with react-hook-form and zod validation
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const [forgotPassword] = useMutation(FORGOT_PASSWORD_MUTATION, {
    onCompleted: () => setSuccess(true),
    onError: (e) => {
      setError(e.message || 'Failed to send reset email. Please try again.');
      console.error('Password reset error:', e);
    },
  });

  const handleResetPassword = async (values: FormValues) => {
    setError(null);
    await forgotPassword({ variables: { email: values.email } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
    >
      <Card className="premium-card w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl premium-text text-center">Forgot password?</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success ? (
            <div className="space-y-4">
              <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <AlertDescription>
                  We&apos;ve sent a password reset link to your email address. Please check your inbox.
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-center">
                <Link href="/auth/login">
                  <Button variant="outline" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleResetPassword)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="name@example.com" 
                            className="pl-10" 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  variant="premium"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Sending reset link..." : "Send reset link"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        
        {!success && (
          <CardFooter className="flex justify-center">
            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Back to login
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  );
} 