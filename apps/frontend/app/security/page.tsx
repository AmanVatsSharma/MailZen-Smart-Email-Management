import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const securityRows = [
  {
    title: 'Authentication and access control',
    detail:
      'JWT-backed authenticated sessions plus admin-guarded operations for sensitive workflows.',
  },
  {
    title: 'Auditability',
    detail:
      'Critical operational and admin actions are tracked with compliance-focused audit logging.',
  },
  {
    title: 'Retention and governance',
    detail:
      'Configurable retention and purge workflows support data lifecycle governance.',
  },
  {
    title: 'Operational observability',
    detail:
      'Structured logs and scheduler-level visibility help teams monitor reliability and incidents.',
  },
  {
    title: 'Legal and compliance exports',
    detail:
      'Admin workflows include export capabilities to support legal/compliance requests.',
  },
  {
    title: 'Resilience by design',
    detail:
      'Core workflows are instrumented for non-blocking audit writes and fault-tolerant operations.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell
      title="Built with business security and compliance workflows in mind."
      description="MailZen is designed to support operational trust through auditable actions, governed retention, and resilient backend controls."
      ctaLabel="Contact security team"
      ctaHref="/contact"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {securityRows.map((item) => (
          <Card key={item.title} className="h-full">
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.detail}
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingShell>
  );
}
