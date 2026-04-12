'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Star, StarOff, ChevronDown, ChevronUp, Clock, Mail, TrendingUp, Crown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GET_TOP_SENDERS,
  GET_SENDER_PROFILE,
  GET_VIP_SENDERS,
  SET_SENDER_VIP,
} from '@/lib/apollo/queries/sender-intelligence';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type SenderProfile = {
  senderEmail: string;
  displayName?: string | null;
  emailCount: number;
  relationshipScore?: number | null;
  isVip: boolean;
  lastEmailAt?: string | null;
  topics?: string[] | null;
  avgResponseTimeHours?: number | null;
};

function getInitials(name?: string | null, email?: string): string {
  if (name && name.trim()) {
    return name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
  return (email ?? '?')[0].toUpperCase();
}

function SenderRow({
  sender,
  onVipToggle,
  vipLoading,
}: {
  sender: SenderProfile;
  onVipToggle: (email: string, current: boolean) => void;
  vipLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadProfile, { data: profileData, loading: profileLoading }] = useLazyQuery<{
    senderProfile: SenderProfile;
  }>(GET_SENDER_PROFILE);

  const profile: SenderProfile = profileData?.senderProfile ?? sender;
  const score = Math.round((profile.relationshipScore ?? 0) * 100);
  const isToggling = vipLoading === sender.senderEmail;

  const handleExpand = () => {
    if (!expanded && !profileData) {
      void loadProfile({ variables: { email: sender.senderEmail } });
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="rounded-lg border border-border/40 bg-background/60 overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={handleExpand}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback
            className="text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 44%))' }}
          >
            {getInitials(sender.displayName, sender.senderEmail)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium leading-none">
              {sender.displayName || sender.senderEmail}
            </p>
            {sender.isVip && (
              <Crown className="h-3 w-3 flex-shrink-0 text-amber-500" />
            )}
          </div>
          {sender.displayName && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {sender.senderEmail}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <Progress
              value={score}
              className="h-1 flex-1 bg-muted"
              style={{ '--progress-color': 'hsl(262 83% 58%)' } as React.CSSProperties}
            />
            <span className="text-[10px] text-muted-foreground w-6 text-right">{score}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge className="bg-muted text-muted-foreground border-border/40 text-[10px] h-4 px-1.5">
            {sender.emailCount}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-amber-500 transition-colors"
            disabled={isToggling}
            onClick={(e) => {
              e.stopPropagation();
              onVipToggle(sender.senderEmail, sender.isVip);
            }}
            title={sender.isVip ? 'Remove VIP' : 'Mark as VIP'}
          >
            {sender.isVip ? (
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            ) : (
              <StarOff className="h-3.5 w-3.5" />
            )}
          </Button>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 bg-muted/10 px-3 pb-3 pt-2.5 space-y-2">
              {profileLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ) : (
                <>
                  <div className="flex gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {profile.emailCount} emails
                    </span>
                    {profile.avgResponseTimeHours != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        avg. {profile.avgResponseTimeHours.toFixed(1)}h response
                      </span>
                    )}
                    {profile.lastEmailAt && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {formatDistanceToNow(new Date(profile.lastEmailAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  {profile.topics && profile.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {profile.topics.slice(0, 6).map((topic) => (
                        <Badge
                          key={topic}
                          className="h-4 px-1.5 text-[10px] bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SenderListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-4 w-6 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SenderIntelligencePanel() {
  const [vipLoading, setVipLoading] = useState<string | null>(null);

  const { data: topData, loading: topLoading, refetch: refetchTop } = useQuery<{
    topSenders: SenderProfile[];
  }>(GET_TOP_SENDERS, {
    variables: { limit: 15 },
    fetchPolicy: 'cache-and-network',
  });

  const { data: vipData, loading: vipLoading2, refetch: refetchVip } = useQuery<{
    vipSenders: SenderProfile[];
  }>(GET_VIP_SENDERS, {
    fetchPolicy: 'cache-and-network',
  });

  const [setSenderVip] = useMutation(SET_SENDER_VIP, {
    onCompleted: () => {
      void refetchTop();
      void refetchVip();
      setVipLoading(null);
    },
    onError: () => setVipLoading(null),
  });

  const handleVipToggle = (email: string, current: boolean) => {
    setVipLoading(email);
    void setSenderVip({ variables: { email, isVip: !current } });
  };

  const topSenders = topData?.topSenders ?? [];
  const vipSenders = vipData?.vipSenders ?? [];

  return (
    <Tabs defaultValue="top" className="flex h-full flex-col">
      <TabsList className="mx-0 grid w-full grid-cols-2 rounded-lg bg-muted/40 h-8">
        <TabsTrigger value="top" className="rounded-md text-xs h-6">
          Top Senders
        </TabsTrigger>
        <TabsTrigger value="vip" className="rounded-md text-xs h-6 gap-1">
          <Crown className="h-3 w-3" />
          VIP Contacts
          {vipSenders.length > 0 && (
            <Badge className="ml-1 h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">
              {vipSenders.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="top" className="mt-3 flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          {topLoading && topSenders.length === 0 ? (
            <SenderListSkeleton />
          ) : topSenders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No senders tracked yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Sync your inbox to populate sender data.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {topSenders.map((sender) => (
                <SenderRow
                  key={sender.senderEmail}
                  sender={sender}
                  onVipToggle={handleVipToggle}
                  vipLoading={vipLoading}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="vip" className="mt-3 flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-1">
          {vipLoading2 && vipSenders.length === 0 ? (
            <SenderListSkeleton />
          ) : vipSenders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Crown className="mb-3 h-8 w-8 text-amber-500/40" />
              <p className="text-sm text-muted-foreground">No VIP contacts yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Star a sender in the Top Senders list to mark them as VIP.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {vipSenders.map((sender) => (
                <SenderRow
                  key={sender.senderEmail}
                  sender={sender}
                  onVipToggle={handleVipToggle}
                  vipLoading={vipLoading}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
