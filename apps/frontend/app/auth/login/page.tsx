import { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';
import { LoginAssistantAdapter } from '@/components/auth/LoginAssistantAdapter';

export const metadata: Metadata = {
  title: 'Login | MailZen',
  description: 'Sign in to your MailZen account',
};

export default function AuthLoginPage() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <LoginForm />
      <LoginAssistantAdapter />
    </div>
  );
}
