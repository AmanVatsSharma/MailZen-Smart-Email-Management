'use client';

import React, { useState } from 'react';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import {
  CheckCircle,
  CreditCard,
  Download,
  FileText,
  RefreshCw,
  Rocket,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  CREATE_RAZORPAY_CHECKOUT_SESSION,
  CREATE_STRIPE_CHECKOUT_SESSION,
  GET_BILLING_SNAPSHOT,
  GET_ENTITLEMENT_USAGE,
  GET_MY_AI_CREDIT_BALANCE,
  GET_MY_BILLING_DATA_EXPORT,
  GET_MY_BILLING_INVOICES,
  REQUEST_PLAN_UPGRADE,
  SELECT_MY_PLAN,
  START_MY_PLAN_TRIAL,
} from '@/lib/apollo/queries/billing';

type BillingPlan = {
  code: string;
  name: string;
  priceMonthlyCents: number;
  currency: string;
  providerLimit: number;
  mailboxLimit: number;
  workspaceLimit: number;
  aiCreditsPerMonth: number;
  isActive: boolean;
};

type BillingInvoiceRow = {
  id: string;
  planCode: string;
  invoiceNumber: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
};

type PaymentGateway = 'stripe' | 'razorpay';

const PLAN_FEATURES: Record<string, string[]> = {
  FREE: ['1 email provider', '1 mailbox', '50 AI credits/month', '1 workspace', '3 team members'],
  PRO: ['5 email providers', '5 mailboxes', '500 AI credits/month', '5 workspaces', '25 team members', 'Smart replies', 'Priority support'],
  BUSINESS: ['25 email providers', '25 mailboxes', '5,000 AI credits/month', '25 workspaces', '200 team members', 'Smart replies', 'Email warmup', 'Analytics', 'Dedicated support'],
};

const GatewayButton = ({
  gateway,
  selected,
  label,
  logo,
  onSelect,
}: {
  gateway: PaymentGateway;
  selected: PaymentGateway;
  label: string;
  logo: React.ReactNode;
  onSelect: (g: PaymentGateway) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(gateway)}
    className={[
      'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
      selected === gateway
        ? 'border-primary bg-primary/10 text-primary shadow-sm'
        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
    ].join(' ')}
  >
    {logo}
    {label}
  </button>
);

const StripeLogo = () => (
  <svg viewBox="0 0 60 25" className="h-4 w-auto" aria-hidden="true" fill="currentColor">
    <path d="M59.6 14.3c0-3.9-1.9-7-5.5-7-3.7 0-5.9 3.1-5.9 7s2 7 5.9 7c1.7 0 3-.4 3.9-1v-2.6c-.9.7-1.9 1.1-3.2 1.1-1.3 0-2.4-.5-2.6-2.1h6.4v-.4zm-6.4-1.4c0-1.5.9-2.2 1.9-2.2s1.8.7 1.8 2.2h-3.7zm-8.2-6.4c-1.2 0-2 .5-2.5 1l-.1-.9h-3v16.5l3.4-.7v-4c.5.4 1.2.9 2.2.9 2.2 0 4.2-1.7 4.2-5.5-.1-3.5-2.1-5.3-4.2-5.3zm-.7 8.1c-.7 0-1.2-.3-1.5-.6V12c.3-.4.8-.6 1.5-.6 1.2 0 2 1.3 2 2.6s-.8 2.6-2 2.6zm-8.3-9.4l-3.4.7v12.4h3.4V5.2zM30.3 4l-3.3.7V8l3.3-.7V4zM23 8.7l-.2-1h-2.9v12.6h3.3V12c.8-1 2.1-.8 2.5-.7V7.8c-.5-.2-2.3-.5-3.7.9zm-9.1-2.2l-3.3.7-.1 9.8c0 1.8 1.3 3.1 3.1 3.1 1 0 1.7-.2 2.1-.4v-2.7c-.4.1-2.3.7-2.3-1v-5h2.3V7.8h-2.3l.5-1.3zM4.3 11.3c0-.5.5-.7 1.2-.7 1.1 0 2.4.3 3.5.9V8.3c-1.2-.5-2.4-.7-3.5-.7C2.3 7.6 0 9 0 11.4c0 3.8 5.2 3.2 5.2 4.8 0 .6-.5.8-1.3.8-1.1 0-2.6-.5-3.7-1.1v3.2c1.3.6 2.5.8 3.7.8 2.8 0 4.8-1.4 4.8-3.8-.1-4-5.4-3.3-5.4-4.8z" />
  </svg>
);

const RazorpayLogo = () => (
  <svg viewBox="0 0 78 24" className="h-4 w-auto" aria-hidden="true" fill="currentColor">
    <path d="M14.8 0L8.3 16.7H4.6L0 0h3.7l2.8 10.9L10 0h4.8zM23.9 16.7h-3.5V0h3.5v16.7zM36.1 16.7h-3.5V2.9h-3.8V0h11v2.9h-3.7v13.8zM51.8 9.4L56.1 0h3.8L52.7 16.7h-1.8L43.6 0h3.8l4.4 9.4zM72.2 0l-6.5 16.7H62l-4.6-16.7h3.7l2.8 10.9L67.3 0h4.9z" />
  </svg>
);

const BillingSettingsPage = () => {
  const { toast } = useToast();
  const [upgradeNote, setUpgradeNote] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('stripe');

  const { data, loading, error, refetch } = useQuery(GET_BILLING_SNAPSHOT, {
    fetchPolicy: 'network-only',
  });

  const { data: usageData } = useQuery(GET_ENTITLEMENT_USAGE, {
    fetchPolicy: 'network-only',
  });

  const { data: aiCreditBalanceData } = useQuery(GET_MY_AI_CREDIT_BALANCE, {
    fetchPolicy: 'cache-and-network',
  });

  const { data: invoicesData, loading: invoicesLoading } = useQuery<{
    myBillingInvoices: BillingInvoiceRow[];
  }>(GET_MY_BILLING_INVOICES, {
    variables: { limit: 25 },
    fetchPolicy: 'network-only',
  });

  const [fetchBillingExport, { loading: billingExportLoading }] = useLazyQuery(
    GET_MY_BILLING_DATA_EXPORT,
    { fetchPolicy: 'network-only' },
  );

  const [selectMyPlan, { loading: selectingPlan }] = useMutation(SELECT_MY_PLAN, {
    onCompleted: async () => {
      await refetch();
      toast({ title: 'Plan updated', description: 'Your subscription plan has been updated.' });
    },
  });

  const [createCheckoutSession] = useMutation(CREATE_STRIPE_CHECKOUT_SESSION, {
    onError: (err) => {
      setCheckoutLoading(null);
      toast({
        title: 'Checkout unavailable',
        description: err.message.includes('STRIPE_SECRET_KEY')
          ? 'Payment processing is not yet configured. Use the upgrade request below.'
          : err.message,
        variant: 'destructive',
      });
    },
  });

  const [createRazorpaySession] = useMutation(CREATE_RAZORPAY_CHECKOUT_SESSION, {
    onError: (err) => {
      setCheckoutLoading(null);
      toast({
        title: 'Checkout unavailable',
        description: err.message.includes('RAZORPAY_KEY_ID')
          ? 'Razorpay is not yet configured. Try Stripe or use the upgrade request below.'
          : err.message,
        variant: 'destructive',
      });
    },
  });

  const [requestUpgrade, { loading: requestingUpgrade }] = useMutation(
    REQUEST_PLAN_UPGRADE,
    {
      onCompleted: async (payload) => {
        await refetch();
        toast({
          title: payload?.requestMyPlanUpgrade?.success
            ? 'Upgrade request sent'
            : 'Upgrade request failed',
          description:
            payload?.requestMyPlanUpgrade?.message || 'Upgrade request was submitted.',
        });
        setUpgradeNote('');
      },
    },
  );

  const [startTrial, { loading: startingTrial }] = useMutation(START_MY_PLAN_TRIAL, {
    onCompleted: async (payload) => {
      await refetch();
      toast({
        title: 'Trial started!',
        description: `Enjoy ${payload?.startMyPlanTrial?.planCode} features. Trial ends ${
          payload?.startMyPlanTrial?.trialEndsAt
            ? new Date(payload.startMyPlanTrial.trialEndsAt).toLocaleDateString()
            : 'soon'
        }.`,
      });
    },
    onError: (err) => toast({ title: 'Trial failed', description: err.message, variant: 'destructive' }),
  });

  const subscriptionStatus: string = data?.mySubscription?.status || '';
  const isTrialing = subscriptionStatus === 'TRIALING';

  const plans: BillingPlan[] = data?.billingPlans || [];
  const currentPlanCode: string = data?.mySubscription?.planCode || 'FREE';
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode);
  const usage = usageData?.myEntitlementUsage;

  const handleSelectFreePlan = async () => {
    await selectMyPlan({ variables: { planCode: 'FREE' } });
  };

  const handleStripePaidPlan = async (planCode: string) => {
    setCheckoutLoading(planCode);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const result = await createCheckoutSession({
      variables: {
        planCode,
        successUrl: `${origin}/settings/billing?checkout=success&plan=${planCode}`,
        cancelUrl: `${origin}/settings/billing?checkout=cancelled`,
      },
    });
    setCheckoutLoading(null);
    const sessionUrl = result?.data?.createStripeCheckoutSession?.sessionUrl;
    if (sessionUrl) {
      window.location.href = sessionUrl;
    }
  };

  const handleRazorpayPaidPlan = async (planCode: string) => {
    setCheckoutLoading(planCode);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const result = await createRazorpaySession({
      variables: {
        planCode,
        successUrl: `${origin}/settings/billing?checkout=success&plan=${planCode}`,
        cancelUrl: `${origin}/settings/billing?checkout=cancelled`,
      },
    });
    setCheckoutLoading(null);
    const checkoutUrl = result?.data?.createRazorpayCheckoutSession?.checkoutUrl;
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  };

  const handlePaidPlan = (planCode: string) => {
    if (selectedGateway === 'razorpay') {
      return handleRazorpayPaidPlan(planCode);
    }
    return handleStripePaidPlan(planCode);
  };

  const handleBillingDataExport = async () => {
    const res = await fetchBillingExport();
    const exp = res.data?.myBillingDataExport;
    if (!exp?.dataJson) {
      toast({
        title: 'Export failed',
        description: 'No billing data returned.',
        variant: 'destructive',
      });
      return;
    }
    const blob = new Blob([exp.dataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailzen-billing-export-${exp.generatedAtIso || 'data'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download started', description: 'Billing export saved as JSON.' });
  };

  const handleUpgradeIntent = async (planCode: string) => {
    await requestUpgrade({
      variables: { targetPlanCode: planCode, note: upgradeNote.trim() || undefined },
    });
  };

  const hasPaidPlans = plans.some((p) => p.priceMonthlyCents > 0);

  return (
    <DashboardPageShell
      title="Billing & Plan"
      description="Manage your subscription, usage limits, and payment."
      contentClassName="max-w-5xl space-y-6"
    >
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load billing data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {currentPlan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Current plan: {currentPlan.name}</CardTitle>
                <CardDescription>
                  {currentPlan.priceMonthlyCents > 0
                    ? `$${(currentPlan.priceMonthlyCents / 100).toFixed(2)} / month`
                    : 'Free forever'}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {currentPlanCode}
              </Badge>
            </div>
          </CardHeader>
          {usage && (
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Providers</span>
                    <span className="font-medium">{usage.providerUsed} / {usage.providerLimit}</span>
                  </div>
                  <Progress value={(usage.providerUsed / Math.max(usage.providerLimit, 1)) * 100} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Mailboxes</span>
                    <span className="font-medium">{usage.mailboxUsed} / {usage.mailboxLimit}</span>
                  </div>
                  <Progress value={(usage.mailboxUsed / Math.max(usage.mailboxLimit, 1)) * 100} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">AI Credits ({usage.periodStart})</span>
                    <span className="font-medium">{usage.aiCreditsUsed} / {usage.aiCreditsPerMonth}</span>
                  </div>
                  <Progress value={(usage.aiCreditsUsed / Math.max(usage.aiCreditsPerMonth, 1)) * 100} className="h-2" />
                </div>
              </div>
              {aiCreditBalanceData?.myAiCreditBalance?.lastConsumedAtIso ? (
                <p className="text-xs text-muted-foreground">
                  Last AI credit use:{' '}
                  {new Date(aiCreditBalanceData.myAiCreditBalance.lastConsumedAtIso).toLocaleString()}
                </p>
              ) : null}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Invoices & data export
            </CardTitle>
            <CardDescription>Recent invoices and a JSON export of your billing record.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => void handleBillingDataExport()}
            disabled={billingExportLoading}
          >
            {billingExportLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export billing JSON
          </Button>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <p className="text-sm text-muted-foreground">Loading invoices…</p>
          ) : (invoicesData?.myBillingInvoices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">Invoice</th>
                    <th className="p-2 font-medium">Plan</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Amount</th>
                    <th className="p-2 font-medium">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoicesData?.myBillingInvoices ?? []).map((inv) => (
                    <tr key={inv.id} className="border-b border-border/40 last:border-0">
                      <td className="p-2 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="p-2">{inv.planCode}</td>
                      <td className="p-2 capitalize">{inv.status}</td>
                      <td className="p-2">
                        {(inv.amountCents / 100).toFixed(2)} {inv.currency}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {inv.periodStart && inv.periodEnd
                          ? `${new Date(inv.periodStart).toLocaleDateString()} – ${new Date(inv.periodEnd).toLocaleDateString()}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {hasPaidPlans && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Payment gateway</p>
          <div className="flex flex-wrap items-center gap-2">
            <GatewayButton
              gateway="stripe"
              selected={selectedGateway}
              label="Pay with Stripe"
              logo={<StripeLogo />}
              onSelect={setSelectedGateway}
            />
            <GatewayButton
              gateway="razorpay"
              selected={selectedGateway}
              label="Pay with Razorpay"
              logo={<RazorpayLogo />}
              onSelect={setSelectedGateway}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedGateway === 'razorpay'
              ? 'Razorpay — supports UPI, net banking, cards, and wallets (INR-friendly).'
              : 'Stripe — global card payments, Apple Pay, and Google Pay.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const monthlyPrice = (plan.priceMonthlyCents / 100).toFixed(2);
          const isPaid = plan.priceMonthlyCents > 0;
          const features = PLAN_FEATURES[plan.code] || [];
          const isLoadingThis = checkoutLoading === plan.code || (selectingPlan && !isPaid);

          return (
            <Card
              key={plan.code}
              className={isCurrent ? 'border-primary ring-1 ring-primary/20' : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && (
                    <Badge className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xl font-semibold text-foreground">
                  {isPaid ? `$${monthlyPrice}` : 'Free'}
                  {isPaid && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {isCurrent ? (
                  <Button className="w-full" variant="outline" disabled>
                    {isTrialing ? '✓ Trial active' : 'Current plan'}
                  </Button>
                ) : isPaid ? (
                  <>
                    <Button
                      className="w-full gap-1"
                      disabled={isLoadingThis || loading}
                      onClick={() => handlePaidPlan(plan.code)}
                    >
                      {isLoadingThis ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          Subscribe via {selectedGateway === 'razorpay' ? 'Razorpay' : 'Stripe'} — ${monthlyPrice}/mo
                        </>
                      )}
                    </Button>
                    {!isTrialing && (
                      <Button
                        className="w-full gap-1"
                        variant="outline"
                        size="sm"
                        disabled={startingTrial}
                        onClick={() => startTrial({ variables: { planCode: plan.code } })}
                      >
                        {startingTrial ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Start Free Trial
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    className="w-full gap-1"
                    variant="outline"
                    disabled={isLoadingThis || loading}
                    onClick={handleSelectFreePlan}
                  >
                    {isLoadingThis ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Downgrade to Free
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Need a custom or managed upgrade?
          </CardTitle>
          <CardDescription>
            Submit a request and our team will reach out with a tailored plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={upgradeNote}
            onChange={(event) => setUpgradeNote(event.target.value)}
            placeholder="Optional note — team size, support needs, timeline..."
          />
          <Button
            disabled={requestingUpgrade || loading}
            onClick={() => handleUpgradeIntent('BUSINESS')}
          >
            {requestingUpgrade ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Request Business plan assistance'
            )}
          </Button>
        </CardContent>
      </Card>

      <Alert className="border-primary/20 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>Secure, hosted checkout</AlertTitle>
        <AlertDescription>
          Paid plans redirect to a secure{' '}
          <span className="font-medium">Stripe</span> or{' '}
          <span className="font-medium">Razorpay</span> checkout page.
          Your card details are never stored on MailZen servers.
          Subscription state updates instantly via webhooks.
        </AlertDescription>
      </Alert>
    </DashboardPageShell>
  );
};

export default BillingSettingsPage;
