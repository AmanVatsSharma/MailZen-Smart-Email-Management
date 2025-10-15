import { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';
import SignupPhone from '@/components/auth/SignupPhone';

export const metadata: Metadata = {
  title: 'Create an Account | MailZen',
  description: 'Create a new MailZen account to manage your emails efficiently',
};

export default function RegisterPage() {
  return <SignupPhone />;
}