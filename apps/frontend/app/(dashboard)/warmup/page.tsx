'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Play, Pause, Mail, Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { GET_PROVIDERS } from '@/lib/apollo/queries/providers';
import {
  GET_EMAIL_WARMUP_STATUS,
  GET_WARMUP_PERFORMANCE_METRICS,
  PAUSE_EMAIL_WARMUP,
  START_EMAIL_WARMUP,
} from '@/lib/apollo/queries/warmup';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';

type Provider = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
};

type WarmupStatus = {
  id: string;
  providerId: string;
  status: 'ACTIVE' | 'PAUSED' | string;
  currentDailyLimit: number;
  dailyIncrement: number;
  maxDailyEmails: number;
  minimumInterval: number;
  targetOpenRate: number;
  startedAt: string;
  lastRunAt?: string | null;
  activities: {
    id: string;
    emailsSent: number;
    openRate: number;
    date: string;
  }[];
};

type WarmupMetrics = {
  averageOpenRate: number;
  totalEmailsSent: number;
  daysActive: number;
  currentPhase: string;
};

const WarmupPage = () => {
  const { toast } = useToast();
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');

  const { data: providersData, loading: loadingProviders } = useQuery(GET_PROVIDERS, {
    fetchPolicy: 'network-only',
  });

  const providers = useMemo<Provider[]>(() => providersData?.providers ?? [], [providersData]);

  useEffect(() => {
    if (selectedProviderId) return;
    const activeProvider = providers.find((provider) => provider.isActive) ?? providers[0];
    if (activeProvider?.id) {
      setSelectedProviderId(activeProvider.id);
    }
  }, [providers, selectedProviderId]);

  const {
    data: warmupData,
    loading: loadingWarmup,
    error: warmupError,
    refetch: refetchWarmup,
  } = useQuery(GET_EMAIL_WARMUP_STATUS, {
    variables: { providerId: selectedProviderId },
    skip: !selectedProviderId,
    fetchPolicy: 'network-only',
  });

  const warmup: WarmupStatus | null = warmupData?.getEmailWarmupStatus ?? null;

  const {
    data: metricsData,
    loading: loadingMetrics,
    refetch: refetchMetrics,
  } = useQuery(GET_WARMUP_PERFORMANCE_METRICS, {
    variables: { warmupId: warmup?.id ?? '' },
    skip: !warmup?.id,
    fetchPolicy: 'network-only',
  });

  const metrics: WarmupMetrics | null = metricsData?.getWarmupPerformanceMetrics ?? null;

  const [startWarmup, { loading: startingWarmup }] = useMutation(START_EMAIL_WARMUP);
  const [pauseWarmup, { loading: pausingWarmup }] = useMutation(PAUSE_EMAIL_WARMUP);

  const busy = startingWarmup || pausingWarmup;
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

  const progress = useMemo(() => {
    if (!warmup) return 0;
    return Math.round((warmup.currentDailyLimit / warmup.maxDailyEmails) * 100);
  }, [warmup]);

  const handleToggleWarmup = async () => {
    if (!selectedProviderId) {
      toast({
        title: 'Select provider first',
        description: 'Choose an active provider to start warmup.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!warmup || warmup.status === 'PAUSED') {
        await startWarmup({
          variables: {
            input: {
              providerId: selectedProviderId,
            },
          },
        });
        toast({
          title: warmup ? 'Warmup resumed' : 'Warmup started',
          description: 'Email warmup is now active for this provider.',
        });
      } else {
        await pauseWarmup({
          variables: {
            input: {
              providerId: selectedProviderId,
            },
          },
        });
        toast({
          title: 'Warmup paused',
          description: 'Warmup has been paused for this provider.',
        });
      }

      await refetchWarmup();
      if (warmup?.id) {
        await refetchMetrics();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Warmup action failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardPageShell
      title="Email Warmup"
      description="Monitor deliverability warmup progress using live backend data."
      actions={(
        <>
          <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
            <SelectTrigger className="w-[260px] md:w-[320px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={warmup?.status === 'ACTIVE' ? 'outline' : 'default'}
            onClick={handleToggleWarmup}
            disabled={busy || !selectedProviderId}
            className="gap-1"
          >
            {warmup?.status === 'ACTIVE' ? (
              <>
                <Pause className="h-4 w-4" />
                Pause Warmup
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {warmup ? 'Resume Warmup' : 'Start Warmup'}
              </>
            )}
          </Button>
        </>
      )}
      contentClassName="space-y-4"
    >

      {loadingProviders || loadingWarmup ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Loading warmup status...
          </CardContent>
        </Card>
      ) : warmupError ? (
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            Failed to load warmup status: {warmupError.message}
          </CardContent>
        </Card>
      ) : !selectedProvider ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Connect an email provider first, then return to start warmup.
          </CardContent>
        </Card>
      ) : !warmup ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">No warmup active for {selectedProvider.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Start warmup to gradually build sender reputation and improve inbox placement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Warmup Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={warmup.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {warmup.status}
                </Badge>
                <p className="text-xs text-muted-foreground">{selectedProvider.email}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daily Limit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{warmup.currentDailyLimit}</div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Target max: {warmup.maxDailyEmails}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Open Rate Target</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{warmup.targetOpenRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Current average: {metrics ? metrics.averageOpenRate.toFixed(1) : '--'}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Last Run</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="inline-flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {warmup.lastRunAt ? new Date(warmup.lastRunAt).toLocaleString() : 'Not run yet'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Interval: every {warmup.minimumInterval} minutes
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Warmup Activity</CardTitle>
                <CardDescription>Latest activity records from backend warmup jobs.</CardDescription>
              </CardHeader>
              <CardContent>
                {warmup.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity records yet.</p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {warmup.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="grid grid-cols-3 gap-3 px-4 py-3 text-sm"
                      >
                        <span>{new Date(activity.date).toLocaleDateString()}</span>
                        <span>Sent: {activity.emailsSent}</span>
                        <span>Open rate: {activity.openRate.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Snapshot</CardTitle>
                <CardDescription>Computed warmup metrics.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMetrics ? (
                  <p className="text-sm text-muted-foreground">Loading metrics...</p>
                ) : metrics ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span>Phase: {metrics.currentPhase}</span>
                    </div>
                    <p className="text-sm">Days active: {metrics.daysActive}</p>
                    <p className="text-sm">Emails sent: {metrics.totalEmailsSent}</p>
                    <p className="text-sm">
                      Avg open rate: {metrics.averageOpenRate.toFixed(1)}%
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Metrics appear after warmup activity starts.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardPageShell>
  );
};

export default WarmupPage;
