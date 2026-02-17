import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const valueCards = [
  {
    title: 'One inbox for everything',
    description:
      'Connect Gmail and Outlook, then manage all conversations from one unified workspace.',
  },
  {
    title: 'AI that helps you move faster',
    description:
      'Summaries, reply drafts, and follow-up support help teams respond with speed and clarity.',
  },
  {
    title: 'Business controls built in',
    description:
      'Audit-ready workflows, retention controls, and legal export tooling support operations at scale.',
  },
];

const audienceTags = [
  'Founders',
  'Sales teams',
  'Agencies',
  'Operations',
  'Customer success',
];

export default function HomePage() {
  return (
    <MarketingShell
      title="Turn email chaos into business clarity."
      description="MailZen is an AI-powered business inbox that unifies accounts, accelerates replies, and gives teams operational control."
      ctaLabel="Create your workspace"
      ctaHref="/auth/register"
    >
      <div className="space-y-10">
        <div className="grid gap-4 md:grid-cols-3">
          {valueCards.map((item) => (
            <Card key={item.title} className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {item.description}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Who MailZen is for</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              MailZen is built for teams and professionals who live in email and
              need speed, consistency, and visibility without adding complexity.
            </p>
            <div className="flex flex-wrap gap-2">
              {audienceTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to see MailZen in action?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link href="/features" className="text-primary underline-offset-4 hover:underline">
              Explore features
            </Link>
            <span>·</span>
            <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
              View pricing
            </Link>
            <span>·</span>
            <Link href="/auth/register" className="text-primary underline-offset-4 hover:underline">
              Start free
            </Link>
          </CardContent>
        </Card>
      </div>
    </MarketingShell>
  );
}