import { Metadata } from 'next';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password | MailZen',
  description: 'Reset your MailZen account password',
};

export default function AuthForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
