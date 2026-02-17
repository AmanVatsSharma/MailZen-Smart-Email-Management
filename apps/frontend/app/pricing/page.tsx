import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketingShell } from '@/components/marketing/marketing-shell';

const plans = [
  {
    name: 'Starter',
    price: '$19',
    period: '/user/month',
    points: [
      'Unified inbox for core accounts',
      'AI summaries and reply drafts',
      'Workspace and basic analytics',
    ],
  },
  {
    name: 'Growth',
    price: '$49',
    period: '/user/month',
    points: [
      'Advanced sync and mailbox controls',
      'Priority automation and smart alerts',
      'Admin exports and deeper observability',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    points: [
      'Security and compliance customization',
      'Dedicated onboarding and support',
      'Volume pricing and enterprise governance',
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingShell
      title="Flexible plans built for teams that scale."
      description="Start with a lightweight plan, then grow into advanced controls and enterprise governance as your operations mature."
      ctaLabel="Talk to sales"
      ctaHref="/contact"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className="h-full">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-semibold tracking-tight">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">
                  {plan.period}
                </span>
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Pricing shown as illustrative tiers for product positioning. Final
        commercial packaging can be tailored per market and segment.
      </p>
    </MarketingShell>
  );
}
