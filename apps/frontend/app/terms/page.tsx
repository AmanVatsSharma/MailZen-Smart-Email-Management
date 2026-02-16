import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const termsItems = [
  {
    title: 'Service scope',
    detail:
      'MailZen provides workflow software for inbox management, collaboration, and AI-assisted communication.',
  },
  {
    title: 'Account responsibilities',
    detail:
      'Customers are responsible for securing user access, credentials, and usage of connected email providers.',
  },
  {
    title: 'Acceptable use',
    detail:
      'The platform must not be used for abuse, fraud, or activity that violates applicable law or provider policy.',
  },
  {
    title: 'Commercial terms',
    detail:
      'Pricing, support scope, and contractual commitments are governed by the applicable order form or agreement.',
  },
];

export default function TermsPage() {
  return (
    <MarketingShell
      title="Terms overview"
      description="This page summarizes core product terms at a high level for business buyers and operators."
      ctaLabel="Talk to sales"
      ctaHref="/contact"
    >
      <Card>
        <CardHeader>
          <CardTitle>Terms summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {termsItems.map((item) => (
            <div key={item.title}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            This summary is informational. The governing legal documents are the
            signed agreements and formal legal terms between your organization
            and MailZen.
          </p>
        </CardContent>
      </Card>
    </MarketingShell>
  );
}
