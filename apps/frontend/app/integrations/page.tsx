import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const integrationRows = [
  {
    provider: 'Gmail',
    summary:
      'Connect Google accounts for inbox sync, productivity workflows, and day-to-day communication management.',
  },
  {
    provider: 'Outlook',
    summary:
      'Bring Microsoft mailboxes into your unified workspace to operate all customer communication in one place.',
  },
  {
    provider: 'SMTP and custom providers',
    summary:
      'Support additional provider connectivity for teams with custom mail infrastructure needs.',
  },
  {
    provider: 'Notification channels',
    summary:
      'Use in-app alerts and operational notification workflows to keep teams informed of critical states.',
  },
  {
    provider: 'AI action workflows',
    summary:
      'Run AI-assisted workflows for summaries, replies, and follow-up orchestration with policy-aware controls.',
  },
  {
    provider: 'Workspace and billing operations',
    summary:
      'Coordinate team access, roles, and account controls around a business-ready workspace model.',
  },
];

export default function IntegrationsPage() {
  return (
    <MarketingShell
      title="Connect your existing email stack without switching your business process."
      description="MailZen integrates with major providers and operational workflows so teams can centralize execution while keeping existing infrastructure."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {integrationRows.map((item) => (
          <Card key={item.provider} className="h-full">
            <CardHeader>
              <CardTitle>{item.provider}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.summary}
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingShell>
  );
}
