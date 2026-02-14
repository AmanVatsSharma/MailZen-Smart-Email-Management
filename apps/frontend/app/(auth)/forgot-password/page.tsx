import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Forgot Password | MailZen',
  description: 'Reset your MailZen account password',
};

export default function ForgotPasswordPage() {
  redirect('/auth/forgot-password');
} 