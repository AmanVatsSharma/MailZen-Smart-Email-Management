'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Flame,
  Thermometer,
  Calendar,
  ArrowUp,
  ChevronDown,
  BarChart3,
  Clock,
  RefreshCw,
  Settings,
  Mail,
  Filter,
  ChevronRight,
  Layers,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock warmup data
const mockWarmupData = {
  status: 'active', // 'active', 'paused', 'completed'
  startDate: '2023-09-15',
  emailsSent: 128,
  emailsReceived: 112,
  openRate: 87,
  replyRate: 23,
  warmupLevel: 38, // percentage
  dailyLimit: 25,
  currentDay: 14,
  totalDays: 30,
  nextScheduled: '9:30 AM today',
  healthScore: 82, // percentage
  emailAccounts: [
    {
      id: '1',
      email: 'john.smith@company.com',
      provider: 'Gmail',
      status: 'active',
      warmupLevel: 45,
      dailyLimit: 30,
      healthScore: 85,
    },
    {
      id: '2',
      email: 'marketing@company.com',
      provider: 'Outlook',
      status: 'active',
      warmupLevel: 32,
      dailyLimit: 20,
      healthScore: 78,
    },
  ],
  recentActivity: [
    { date: '2023-10-05', sent: 22, received: 19, opened: 18, replied: 5 },
    { date: '2023-10-04', sent: 20, received: 17, opened: 15, replied: 4 },
    { date: '2023-10-03', sent: 18, received: 15, opened: 13, replied: 3 },
    { date: '2023-10-02', sent: 16, received: 14, opened: 12, replied: 3 },
    { date: '2023-10-01', sent: 15, received: 13, opened: 11, replied: 2 },
    { date: '2023-09-30', sent: 12, received: 10, opened: 9, replied: 2 },
    { date: '2023-09-29', sent: 10, received: 9, opened: 8, replied: 2 },
  ],
};

const WarmupPage = () => {
  const [isActive, setIsActive] = useState(mockWarmupData.status === 'active');
  const [selectedAccount, setSelectedAccount] = useState(mockWarmupData.emailAccounts[0].id);

  const getSelectedAccount = () => {
    return mockWarmupData.emailAccounts.find(account => account.id === selectedAccount);
  };

  const handleToggleWarmup = () => {
    setIsActive(!isActive);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Email Warmup</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={isActive ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggleWarmup}
            className="gap-1"
          >
            {isActive ? (
              <>
                <Pause className="h-4 w-4" />
                Pause Warmup
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Resume Warmup
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warmup Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold">{mockWarmupData.warmupLevel}%</div>
              <Progress value={mockWarmupData.warmupLevel} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Target: {mockWarmupData.dailyLimit} emails per day
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold">{mockWarmupData.healthScore}%</div>
              <Progress value={mockWarmupData.healthScore} className="h-2" />
              <p className="text-xs text-muted-foreground">Based on open and reply rates</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold">
                Day {mockWarmupData.currentDay}/{mockWarmupData.totalDays}
              </div>
              <Progress
                value={(mockWarmupData.currentDay / mockWarmupData.totalDays) * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">Started on {mockWarmupData.startDate}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold">{mockWarmupData.nextScheduled}</div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isActive ? 'Warmup is active' : 'Warmup is paused'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Auto-schedule</span>
                <Switch checked={true} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Warmup Performance</CardTitle>
                <Select defaultValue="7days">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="14days">Last 14 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="alltime">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CardDescription>Track your email warmup progress over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border rounded-md bg-muted/20">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Performance Chart Placeholder</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Email Accounts</CardTitle>
              <CardDescription>Manage your accounts in warmup</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {mockWarmupData.emailAccounts.map(account => (
                  <div
                    key={account.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 ${selectedAccount === account.id ? 'bg-muted/30' : ''}`}
                    onClick={() => setSelectedAccount(account.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">{account.email}</div>
                      <Badge
                        variant={account.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {account.status}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mb-2">
                      <span>{account.provider}</span>
                      <span className="mx-2">•</span>
                      <span>{account.dailyLimit} emails/day</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span>Warmup Level</span>
                      <span className="font-medium">{account.warmupLevel}%</span>
                    </div>
                    <Progress value={account.warmupLevel} className="h-1" />
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="border-t p-4">
              <Button variant="outline" className="w-full gap-1">
                <Mail className="h-4 w-4" />
                Add Email Account
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Tabs Content */}
      <Card>
        <CardHeader className="pb-0">
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Warmup Settings</TabsTrigger>
              <TabsTrigger value="templates">Email Templates</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <TabsContent value="activity" className="pt-4">
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-4 py-2 px-4 text-xs font-medium text-muted-foreground">
                <div>Date</div>
                <div>Sent</div>
                <div>Received</div>
                <div>Opened</div>
                <div>Replied</div>
              </div>

              <div className="space-y-1">
                {mockWarmupData.recentActivity.map((day, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-5 gap-4 py-3 px-4 rounded-md hover:bg-muted/50"
                  >
                    <div className="font-medium">{day.date}</div>
                    <div>{day.sent}</div>
                    <div>{day.received}</div>
                    <div>{day.opened}</div>
                    <div>{day.replied}</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Daily Warmup Schedule</label>
                <Select defaultValue="automatic">
                  <SelectTrigger>
                    <SelectValue placeholder="Schedule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automatic (Recommended)</SelectItem>
                    <SelectItem value="manual">Manual Times</SelectItem>
                    <SelectItem value="fixed">Fixed Schedule</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automatic mode adapts to your email usage patterns for a natural warmup.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Warmup Intensity</label>
                  <span className="text-sm">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Slow</span>
                  <Progress value={50} className="h-2 flex-1" />
                  <span className="text-xs">Fast</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Medium intensity increases by 3-5 emails daily and takes about 30 days to
                  complete.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Advanced Settings</label>
                <div className="rounded-md border divide-y">
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Weekend Warmup</div>
                      <div className="text-xs text-muted-foreground">
                        Include weekends in warmup schedule
                      </div>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Open Delay</div>
                      <div className="text-xs text-muted-foreground">
                        Simulate natural email open patterns
                      </div>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Random Reply Length</div>
                      <div className="text-xs text-muted-foreground">
                        Vary reply lengths for authenticity
                      </div>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="pt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">Email Templates</div>
                <Button size="sm" className="gap-1">
                  <Plus className="h-3 w-3" />
                  New Template
                </Button>
              </div>

              <div className="rounded-md border divide-y">
                <div className="p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Business Introduction</div>
                    <Badge>Default</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    Hello [Name], I hope this email finds you well. I wanted to introduce myself and
                    my company...
                  </p>
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ChevronRight className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>

                <div className="p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Follow-up Template</div>
                    <Badge variant="outline">Custom</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    Hi [Name], I'm just following up on our previous conversation about [Topic]. I
                    wanted to check if...
                  </p>
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ChevronRight className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>

                <div className="p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Meeting Request</div>
                    <Badge variant="outline">Custom</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    Dear [Name], I would like to schedule a meeting to discuss [Topic]. Would you be
                    available for a...
                  </p>
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ChevronRight className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Card>
    </div>
  );
};

export default WarmupPage;
