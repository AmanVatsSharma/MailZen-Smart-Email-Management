'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  Mail,
  Clock,
  Zap,
  MessageSquare,
  Send,
  MoreHorizontal,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, Variants } from 'framer-motion';
import { TiltCard } from '@/components/ui/TiltCard';
import { OverviewChart } from '@/components/ui/charts/OverviewChart';
import { StorageChart } from '@/components/ui/charts/StorageChart';
import { ResponseTimeChart } from '@/components/ui/charts/ResponseTimeChart';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Clock className="mr-2 h-4 w-4" />
              Last 7 days
            </Button>
            <Button variant="premium" size="sm">
              <Zap className="mr-2 h-4 w-4" />
              Upgrade
            </Button>
          </div>
        </div>

        <motion.div 
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle>Total Emails</CardTitle>
                  <CardDescription>All emails in your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2,853</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-emerald-500 font-medium">+12%</span> from last month
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={75} className="h-2" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Mail className="h-12 w-12 text-primary" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-amber-500/50">
                <CardHeader className="pb-2">
                  <CardTitle>Unread</CardTitle>
                  <CardDescription>Emails waiting for response</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">24</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-red-500 font-medium">+8%</span> from yesterday
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={35} className="h-2" indicatorColor="bg-linear-to-r from-amber-500 to-amber-300" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <MessageSquare className="h-12 w-12 text-amber-500" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-emerald-500/50">
                <CardHeader className="pb-2">
                  <CardTitle>Sent Today</CardTitle>
                  <CardDescription>Emails sent in last 24h</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">48</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-emerald-500 font-medium">+24%</span> from yesterday
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={65} className="h-2" indicatorColor="bg-linear-to-r from-emerald-500 to-emerald-300" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Send className="h-12 w-12 text-emerald-500" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>

          <motion.div variants={item}>
            <TiltCard>
              <Card className="overflow-hidden h-full border-l-4 border-l-blue-500/50">
                <CardHeader className="pb-2">
                  <CardTitle>Scheduled</CardTitle>
                  <CardDescription>Emails waiting to be sent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">12</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-blue-500 font-medium">+3</span> from yesterday
                  </div>
                  <div className="mt-4 h-1">
                    <Progress value={25} className="h-2" indicatorColor="bg-linear-to-r from-blue-500 to-blue-300" />
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Clock className="h-12 w-12 text-blue-500" />
                </div>
              </Card>
            </TiltCard>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Alert className="bg-linear-to-r from-primary/10 to-primary/5 border-primary/20">
          <Zap className="h-4 w-4 text-primary" />
          <AlertTitle>Smart Replies Active</AlertTitle>
          <AlertDescription>
            AI-powered smart replies are enabled for your account. Your response rate has improved by 35%.
          </AlertDescription>
        </Alert>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList className="bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Activity</CardTitle>
                <CardDescription>Your email activity over the last 30 days.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <OverviewChart />
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <div className="mr-1 size-3 rounded-full bg-primary"></div>
                    Received
                  </div>
                  <div className="flex items-center">
                    <div className="mr-1 size-3 rounded-full bg-blue-500"></div>
                    Sent
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View detailed report
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="storage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Usage</CardTitle>
                <CardDescription>Your account storage usage.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <StorageChart />
                  <div className="space-y-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Used Storage</p>
                        <p className="text-2xl font-bold">4.2 GB</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-medium">Total Storage</p>
                        <p className="text-2xl font-bold">15 GB</p>
                      </div>
                    </div>
                    <Progress value={28} className="h-3" />
                    <div className="mt-2 grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p className="font-medium">Emails</p>
                        <p>2.8 GB</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">Attachments</p>
                        <p>1.2 GB</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">Other</p>
                        <p>0.2 GB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  Manage Storage
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Insights</CardTitle>
                <CardDescription>Analytics and patterns from your email usage.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Response Time Trends</h3>
                    <ResponseTimeChart />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Response Rate</div>
                      <div className="text-2xl font-bold">78%</div>
                      <div className="text-xs text-emerald-500">+12% from last month</div>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Avg. Response Time</div>
                      <div className="text-2xl font-bold">3.2h</div>
                      <div className="text-xs text-emerald-500">-0.8h from last month</div>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Peak Activity</div>
                      <div className="text-2xl font-bold">10-11 AM</div>
                      <div className="text-xs text-muted-foreground">Monday-Friday</div>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 bg-card/50">
                      <div className="text-sm font-medium text-muted-foreground">Smart Replies Used</div>
                      <div className="text-2xl font-bold">42%</div>
                      <div className="text-xs text-emerald-500">+8% from last month</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View All Insights
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-7"
      >
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent email activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 * i, duration: 0.3 }}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="shrink-0">
                    <div className="size-10 rounded-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">
                        {i === 1 && "New lead from website inquiry"}
                        {i === 2 && "Meeting scheduled with marketing team"}
                        {i === 3 && "Project proposal approved"}
                        {i === 4 && "New comment on shared document"}
                      </div>
                      <Badge variant="outline" className="ml-auto shrink-0">
                        {i === 1 && "New"}
                        {i === 2 && "Calendar"}
                        {i === 3 && "Project"}
                        {i === 4 && "Document"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {i === 1 && "John Smith requested information about our services"}
                      {i === 2 && "Weekly marketing sync scheduled for Thursday at 2pm"}
                      {i === 3 && "Client approved the project proposal and timeline"}
                      {i === 4 && "Sarah left a comment on the Q3 planning document"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {i === 1 && "10 minutes ago"}
                      {i === 2 && "1 hour ago"}
                      {i === 3 && "3 hours ago"}
                      {i === 4 && "Yesterday at 4:23 PM"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              View All Activity
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Smart Reply Performance</CardTitle>
            <CardDescription>How your AI-powered replies are performing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center justify-center py-4">
              <div className="relative h-40 w-40">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold">87%</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                </div>
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle
                    className="stroke-slate-200 dark:stroke-slate-800"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    className="stroke-primary"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="251.2"
                    strokeDashoffset="32.7"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Total Generated</div>
                <div className="text-xl font-bold">248</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Used Without Edit</div>
                <div className="text-xl font-bold">182</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Modified</div>
                <div className="text-xl font-bold">34</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Discarded</div>
                <div className="text-xl font-bold">32</div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              Customize Smart Replies
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
