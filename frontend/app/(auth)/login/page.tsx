import { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Login | MailZen',
  description: 'Sign in to your MailZen account',
};

export default function LoginPage() {
  return <LoginForm />;
} 