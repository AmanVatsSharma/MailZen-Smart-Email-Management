import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const privacyItems = [
  {
    title: 'Data usage',
    detail:
      'MailZen processes workspace data to deliver inbox, automation, and observability features requested by users.',
  },
  {
    title: 'Access controls',
    detail:
      'Authenticated and role-guarded access patterns are used to limit sensitive workflow operations.',
  },
  {
    title: 'Retention handling',
    detail:
      'Operational retention policies and purge workflows are available to support governance requirements.',
  },
  {
    title: 'Auditability',
    detail:
      'Key operational actions can be recorded for compliance and support investigations.',
  },
];

export default function PrivacyPage() {
  return (
    <MarketingShell
      title="Privacy at a glance"
      description="This page provides a simple overview of how MailZen approaches privacy, governance, and operational controls."
      ctaLabel="Contact privacy team"
      ctaHref="/contact"
    >
      <Card>
        <CardHeader>
          <CardTitle>Privacy summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacyItems.map((item) => (
            <div key={item.title}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            This is a high-level product page and not legal advice. For legal
            terms, agreements, or custom data processing requirements, contact
            the MailZen team.
          </p>
        </CardContent>
      </Card>
    </MarketingShell>
  );
}
