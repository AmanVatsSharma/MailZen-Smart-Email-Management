"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql, useMutation } from '@apollo/client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from '@/components/ui/form';

const SEND_OTP = gql`
  mutation SignupSendOtp($phoneNumber: String!) {
    signupSendOtp(input: { phoneNumber: $phoneNumber })
  }
`;

const VERIFY_SIGNUP = gql`
  mutation SignupVerify($input: VerifySignupInput!) {
    signupVerify(input: $input) {
      token
      refreshToken
      user { id email name phoneNumber isPhoneVerified }
    }
  }
`;

const step1Schema = z.object({
  phoneNumber: z.string().min(5, 'Enter a valid phone number'),
});

type Step1 = z.infer<typeof step1Schema>;

const step2Schema = z.object({
  code: z.string().min(4, 'Enter the OTP code'),
  handle: z.string().min(3, 'Handle must be at least 3 characters').regex(/^[a-z0-9.]+$/, 'Only lowercase letters, numbers and dots'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

type Step2 = z.infer<typeof step2Schema>;

export default function SignupPhone() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema), defaultValues: { phoneNumber: '' } });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema), defaultValues: { code: '', handle: '', password: '', name: '' } });

  const [sendOtp, { loading: sending }] = useMutation(SEND_OTP, {
    onError: (e) => setError(e.message),
    onCompleted: () => setStep(2),
  });

  const [verifySignup, { loading: verifying }] = useMutation(VERIFY_SIGNUP, {
    onError: (e) => setError(e.message),
    onCompleted: (data) => {
      // Enterprise-grade session: server sets HttpOnly `token` cookie.
      // We DO NOT store access tokens in localStorage.
      localStorage.setItem('user', JSON.stringify(data.signupVerify.user));
      console.log('[SignupPhone] success (token cookie should be set by backend)');
      router.push('/');
    },
  });

  const submitStep1 = async (values: Step1) => {
    setError(null);
    setPhone(values.phoneNumber);
    await sendOtp({ variables: { phoneNumber: values.phoneNumber } });
  };

  const submitStep2 = async (values: Step2) => {
    setError(null);
    await verifySignup({ variables: { input: { phoneNumber: phone, code: values.code, email: `${values.handle}@mailzen.com`, password: values.password, name: values.name, desiredLocalPart: values.handle } } });
  };

  return (
    <div className="flex justify-center items-center min-h-[70vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your MailZen account</CardTitle>
          <CardDescription>{step === 1 ? 'Verify your phone to get started' : 'Pick your @mailzen.com address and password'}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <Form {...form1}>
              <form onSubmit={form1.handleSubmit(submitStep1)} className="space-y-4">
                <FormField name="phoneNumber" control={form1.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" disabled={sending} className="w-full">{sending ? 'Sending...' : 'Send OTP'}</Button>
              </form>
            </Form>
          ) : (
            <Form {...form2}>
              <form onSubmit={form2.handleSubmit(submitStep2)} className="space-y-4">
                <FormField name="code" control={form2.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>OTP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="6-digit code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="handle" control={form2.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Choose your MailZen address</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input placeholder="your.name" {...field} />
                        <div className="px-3 flex items-center rounded border border-input text-muted-foreground">@mailzen.com</div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="password" control={form2.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="name" control={form2.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" disabled={verifying} className="w-full">{verifying ? 'Creating account...' : 'Create account'}</Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
