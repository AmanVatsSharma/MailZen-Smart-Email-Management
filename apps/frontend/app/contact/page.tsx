import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const contactOptions = [
  {
    title: 'Sales',
    detail:
      'Discuss pricing, onboarding strategy, and deployment options for your team.',
    email: 'sales@mailzen.com',
  },
  {
    title: 'Support',
    detail:
      'Get help with setup, integrations, and operational workflows in your workspace.',
    email: 'support@mailzen.com',
  },
  {
    title: 'Security and compliance',
    detail:
      'Reach out for trust reviews, legal workflow support, or governance-related questions.',
    email: 'security@mailzen.com',
  },
];

export default function ContactPage() {
  return (
    <MarketingShell
      title="Let’s plan your MailZen rollout."
      description="Whether you’re evaluating MailZen or already onboarding your team, we can help you move quickly."
      ctaLabel="Start free"
      ctaHref="/auth/register"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {contactOptions.map((item) => (
          <Card key={item.title} className="h-full">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{item.detail}</p>
              <p className="font-medium text-foreground">{item.email}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingShell>
  );
}
