import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Login | MailZen',
  description: 'Sign in to your MailZen account',
};

export default function LoginPage() {
  redirect('/auth/login');
} 