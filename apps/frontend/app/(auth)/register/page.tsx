import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Create an Account | MailZen',
  description: 'Create a new MailZen account to manage your emails efficiently',
};

export default function RegisterPage() {
  redirect('/auth/register');
}