'use client';

import React, { useState } from 'react';
import {
  Save,
  RefreshCw,
  Trash2,
  Sparkles,
  PenLine,
  Clock,
  AlertTriangle,
  Info,
  Plus,
  MessageSquare,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Mock smart reply settings
const mockSmartReplySettings = {
  enabled: true,
  defaultTone: 'professional',
  defaultLength: 'medium',
  aiModel: 'balanced',
  includeSignature: true,
  personalization: 75, // 0-100
  creativityLevel: 60, // 0-100
  maxSuggestions: 3,
  customInstructions: '',
  history: {
    keepHistory: true,
    historyLength: 30, // days
  },
  templates: [
    {
      id: '1',
      name: 'Meeting Follow-up',
      content: "Thanks for the meeting today! I'll work on [task] and get back to you by [date].",
      usage: 15,
    },
    {
      id: '2',
      name: 'Project Update',
      content:
        "I wanted to give you a quick update on [project]. We've completed [task] and are now working on [next task].",
      usage: 8,
    },
    {
      id: '3',
      name: 'Thank You',
      content:
        'Thank you for your email. I appreciate your [feedback/support/input] and will take it into consideration.',
      usage: 22,
    },
  ],
  recentReplies: [
    {
      id: '1',
      text: "Thank you for your inquiry. I'll review the details and get back to you by tomorrow.",
      date: '2 hours ago',
      feedback: 'positive',
    },
    {
      id: '2',
      text: 'I appreciate your feedback and will implement these changes in the next version.',
      date: 'Yesterday',
      feedback: 'neutral',
    },
    {
      id: '3',
      text: "The meeting is confirmed for Thursday at 2 PM. I'll send a calendar invite shortly.",
      date: '3 days ago',
      feedback: 'positive',
    },
  ],
};

const SmartRepliesSettingsPage = () => {
  const [settings, setSettings] = useState(mockSmartReplySettings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Smart Replies Settings</h1>
          <p className="text-muted-foreground">Configure AI-powered email reply suggestions</p>
        </div>
        <Button onClick={handleSaveSettings} className="gap-1" disabled={isSaving}>
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>AI-Powered Smart Replies</AlertTitle>
        <AlertDescription>
          MailZen's Smart Replies feature uses AI to generate context-aware email responses, saving
          you time and effort.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="general">
        <TabsList className="grid grid-cols-4 w-full mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Reply History</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure your basic Smart Reply preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Enable Smart Replies</h3>
                  <p className="text-sm text-muted-foreground">
                    Show AI-generated reply suggestions in your emails
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={checked => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="text-sm font-medium">Default Tone</label>
                  <Select
                    value={settings.defaultTone}
                    onValueChange={value => setSettings({ ...settings, defaultTone: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Default Length</label>
                  <Select
                    value={settings.defaultLength}
                    onValueChange={value => setSettings({ ...settings, defaultLength: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a length" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                      <SelectItem value="medium">Medium (3-4 sentences)</SelectItem>
                      <SelectItem value="long">Long (5+ sentences)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">AI Model</label>
                  <Select
                    value={settings.aiModel}
                    onValueChange={value => setSettings({ ...settings, aiModel: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast (Good quality, quick responses)</SelectItem>
                      <SelectItem value="balanced">Balanced (Recommended)</SelectItem>
                      <SelectItem value="accurate">Advanced (Best quality, slower)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Number of Suggestions</label>
                  <Select
                    value={settings.maxSuggestions.toString()}
                    onValueChange={value =>
                      setSettings({ ...settings, maxSuggestions: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select number of suggestions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 suggestion</SelectItem>
                      <SelectItem value="2">2 suggestions</SelectItem>
                      <SelectItem value="3">3 suggestions</SelectItem>
                      <SelectItem value="5">5 suggestions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Personalization Level</label>
                    <span className="text-sm">{settings.personalization}%</span>
                  </div>
                  <Slider
                    value={[settings.personalization]}
                    max={100}
                    step={1}
                    onValueChange={value => setSettings({ ...settings, personalization: value[0] })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher personalization means replies are more tailored to your writing style and
                    message content
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Creativity Level</label>
                    <span className="text-sm">{settings.creativityLevel}%</span>
                  </div>
                  <Slider
                    value={[settings.creativityLevel]}
                    max={100}
                    step={1}
                    onValueChange={value => setSettings({ ...settings, creativityLevel: value[0] })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher creativity generates more varied and creative responses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Reply Templates</CardTitle>
              <CardDescription>Create and manage custom AI-guided reply templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    New Template
                  </Button>
                </div>

                <div className="space-y-2">
                  {settings.templates.map(template => (
                    <Card key={template.id} className="bg-muted/50">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <div className="text-xs text-muted-foreground">
                            Used {template.usage} times
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-3 px-4 border-t">
                        <div className="text-sm bg-background p-3 rounded-md whitespace-pre-wrap">
                          {template.content}
                        </div>
                      </CardContent>
                      <CardFooter className="py-2 px-4 border-t flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                          <PenLine className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Reply History</CardTitle>
                  <CardDescription>View and manage your Smart Reply history</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm">Keep history</div>
                  <Switch
                    checked={settings.history.keepHistory}
                    onCheckedChange={checked =>
                      setSettings({
                        ...settings,
                        history: { ...settings.history, keepHistory: checked },
                      })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.history.keepHistory ? (
                  <>
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm font-medium">History Duration</label>
                        <Select
                          value={settings.history.historyLength.toString()}
                          onValueChange={value =>
                            setSettings({
                              ...settings,
                              history: { ...settings.history, historyLength: parseInt(value) },
                            })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Smart replies older than this will be automatically deleted
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <h3 className="text-sm font-medium flex items-center gap-1">
                        <History className="h-4 w-4" />
                        Recent Replies
                      </h3>
                      <div className="space-y-2">
                        {settings.recentReplies.map(reply => (
                          <div key={reply.id} className="border p-3 rounded-md">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{reply.date}</span>
                              <span
                                className={
                                  reply.feedback === 'positive'
                                    ? 'text-green-500'
                                    : reply.feedback === 'negative'
                                      ? 'text-red-500'
                                      : 'text-gray-500'
                                }
                              >
                                {reply.feedback.charAt(0).toUpperCase() + reply.feedback.slice(1)}{' '}
                                feedback
                              </span>
                            </div>
                            <div className="text-sm">{reply.text}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-center mt-4">
                        <Button variant="outline" size="sm" className="text-xs">
                          View Full History
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mb-2" />
                    <h3 className="text-lg font-medium">History is disabled</h3>
                    <p className="text-sm text-muted-foreground max-w-md mt-1">
                      Enable history to view and learn from your past smart replies. This helps
                      improve suggestion quality over time.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Fine-tune your Smart Reply experience with advanced options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Include Signature</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatically add your email signature to generated replies
                  </p>
                </div>
                <Switch
                  checked={settings.includeSignature}
                  onCheckedChange={checked =>
                    setSettings({ ...settings, includeSignature: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Instructions</label>
                <Textarea
                  placeholder="Add specific instructions to guide the AI in generating your replies..."
                  value={settings.customInstructions}
                  onChange={e => setSettings({ ...settings, customInstructions: e.target.value })}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Example: "Keep replies concise and direct" or "Always include a friendly greeting
                  and closing"
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="privacy">
                  <AccordionTrigger className="text-sm font-medium">
                    Privacy & Data
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 p-2">
                      <Alert className="bg-muted border-muted-foreground/20">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <AlertTitle>How your data is used</AlertTitle>
                        <AlertDescription className="text-xs">
                          MailZen uses your email data only to generate relevant Smart Reply
                          suggestions. Your data is processed securely and never shared with third
                          parties. You can delete your reply history at any time.
                        </AlertDescription>
                      </Alert>

                      <div className="flex justify-between">
                        <Button variant="outline" size="sm" className="text-xs">
                          Export Reply Data
                        </Button>
                        <Button variant="destructive" size="sm" className="text-xs">
                          Delete All Data
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmartRepliesSettingsPage;
