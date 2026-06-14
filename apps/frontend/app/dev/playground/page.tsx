import { PlaygroundShell } from './_components/playground-shell';
import { MANIFESTS } from './manifest-registry';

export const metadata = {
  title: 'MailZen · Component Playground',
  description: 'Browse, configure, and copy-paste Foundation UI components.',
};

export default function PlaygroundPage() {
  // Production gate — never ship this route
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return <PlaygroundShell manifests={MANIFESTS as unknown as Parameters<typeof PlaygroundShell>[0]['manifests']} />;
}
