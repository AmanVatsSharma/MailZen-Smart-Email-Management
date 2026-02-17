import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

export default function AboutPage() {
  return (
    <MarketingShell
      title="We built MailZen to make business email finally feel under control."
      description="MailZen exists to help teams spend less time managing inbox chaos and more time moving business outcomes forward."
      ctaLabel="Get started"
      ctaHref="/auth/register"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Mission</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Give teams an AI-powered inbox that improves speed, quality, and
            confidence in customer communication.
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Product philosophy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Blend productivity and governance. Every automation should save time
            while keeping operations observable and auditable.
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Who we serve</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Founders, agencies, operations teams, and business units that
            depend on high-volume, high-quality communication.
          </CardContent>
        </Card>
      </div>
    </MarketingShell>
  );
}
