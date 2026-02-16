import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const featureRows = [
  {
    title: 'Unified inbox',
    detail:
      'Bring Gmail and Outlook accounts into one place and work from a single priority view.',
  },
  {
    title: 'AI assistance',
    detail:
      'Generate summaries and draft responses so teams can reply faster with less manual effort.',
  },
  {
    title: '@mailzen.com aliases',
    detail:
      'Create dedicated aliases for teams or workflows and manage them inside shared workspaces.',
  },
  {
    title: 'Smart alerts and notifications',
    detail:
      'Track sync incidents and operational health so you catch issues before customers do.',
  },
  {
    title: 'Admin and compliance controls',
    detail:
      'Use admin-grade exports, retention policies, and audit visibility for business operations.',
  },
  {
    title: 'Team-ready workspaces',
    detail:
      'Support collaboration, role-aware workflows, and scaling from solo founder to full team.',
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell
      title="Everything your team needs to run email as a business system."
      description="MailZen combines unified inbox workflows, AI productivity, and operational controls into one business-ready platform."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {featureRows.map((item) => (
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
