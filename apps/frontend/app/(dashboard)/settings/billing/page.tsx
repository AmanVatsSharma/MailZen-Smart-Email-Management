'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { RefreshCw, Rocket, Sparkles } from 'lucide-react';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  GET_BILLING_SNAPSHOT,
  REQUEST_PLAN_UPGRADE,
  SELECT_MY_PLAN,
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

const BillingSettingsPage = () => {
  const { toast } = useToast();
  const [upgradeNote, setUpgradeNote] = useState('');

  const { data, loading, error, refetch } = useQuery(GET_BILLING_SNAPSHOT, {
    fetchPolicy: 'network-only',
  });

  const [selectMyPlan, { loading: selectingPlan }] = useMutation(SELECT_MY_PLAN, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Plan updated',
        description: 'Your subscription plan has been updated.',
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
            payload?.requestMyPlanUpgrade?.message ||
            'Upgrade request was submitted.',
        });
        setUpgradeNote('');
      },
    },
  );

  const plans: BillingPlan[] = data?.billingPlans || [];
  const currentPlanCode: string = data?.mySubscription?.planCode || 'FREE';
  const usedWorkspaceCount = Number(data?.myWorkspaces?.length || 0);
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode);

  const handleSelectPlan = async (planCode: string) => {
    await selectMyPlan({ variables: { planCode } });
  };

  const handleUpgradeIntent = async (planCode: string) => {
    await requestUpgrade({
      variables: {
        targetPlanCode: planCode,
        note: upgradeNote.trim() || undefined,
      },
    });
  };

  return (
    <DashboardPageShell
      title="Billing & Plan Settings"
      description="Manage subscription tier, limits, and upgrade requests."
      contentClassName="max-w-5xl space-y-6"
    >
      <Alert className="border-primary/20 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>Live billing foundation</AlertTitle>
        <AlertDescription>
          Plan catalog and subscription state are now persisted in backend and
          enforce provider/mailbox limits.
        </AlertDescription>
      </Alert>

      {error && (
        <p className="text-sm text-destructive">Failed to load billing data: {error.message}</p>
      )}

      {currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Current subscription</CardTitle>
            <CardDescription>
              You are currently on <strong>{currentPlan.name}</strong> (
              {currentPlan.code}).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Providers: {currentPlan.providerLimit}
            </Badge>
            <Badge variant="outline">
              Mailboxes: {currentPlan.mailboxLimit}
            </Badge>
            <Badge variant="outline">
              Workspaces: {usedWorkspaceCount}/{currentPlan.workspaceLimit}
            </Badge>
            <Badge variant="outline">
              AI credits/month: {currentPlan.aiCreditsPerMonth}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const monthlyPrice = (plan.priceMonthlyCents / 100).toFixed(2);

          return (
            <Card key={plan.code} className={isCurrent ? 'border-primary/50' : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <CardDescription>
                  {plan.currency} ${monthlyPrice}/month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>Providers: up to {plan.providerLimit}</li>
                  <li>Mailboxes: up to {plan.mailboxLimit}</li>
                  <li>Workspaces: up to {plan.workspaceLimit}</li>
                  <li>AI credits: {plan.aiCreditsPerMonth}/month</li>
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || selectingPlan || loading}
                  onClick={() => handleSelectPlan(plan.code)}
                >
                  {selectingPlan ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Switch to {plan.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Need a managed upgrade?</CardTitle>
          <CardDescription>
            Submit an upgrade intent and MailZen can route this to billing workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={upgradeNote}
            onChange={(event) => setUpgradeNote(event.target.value)}
            placeholder="Optional note (team size, support needs, rollout timeline...)"
          />
          <Button
            disabled={requestingUpgrade || loading}
            onClick={() => handleUpgradeIntent('BUSINESS')}
          >
            {requestingUpgrade ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending request...
              </>
            ) : (
              'Request BUSINESS upgrade assistance'
            )}
          </Button>
        </CardContent>
      </Card>
    </DashboardPageShell>
  );
};

export default BillingSettingsPage;

