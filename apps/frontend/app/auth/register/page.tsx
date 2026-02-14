import { Metadata } from 'next';
import SignupPhone from '@/components/auth/SignupPhone';

export const metadata: Metadata = {
  title: 'Create an Account | MailZen',
  description: 'Create a new MailZen account to manage your emails efficiently',
};

export default function AuthRegisterPage() {
  return <SignupPhone />;
}
