'use client';

import React, { useState } from 'react';
import {
  Plus,
  Filter,
  MoreHorizontal,
  Mail,
  Search,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock filter data for demonstration
const mockFilters = [
  {
    id: '1',
    name: 'Important clients',
    description: 'Mark emails from key clients as important',
    conditions: [
      { type: 'sender', operator: 'contains', value: 'acme.com' },
      { type: 'sender', operator: 'contains', value: 'globex.com' },
    ],
    actions: [
      { type: 'addLabel', value: 'Important' },
      { type: 'markAsImportant', value: true },
    ],
    active: true,
    matchCount: 28,
    lastExecuted: '2 hours ago',
  },
  {
    id: '2',
    name: 'Newsletter cleanup',
    description: 'Move newsletters to dedicated folder',
    conditions: [
      { type: 'subject', operator: 'contains', value: 'newsletter' },
      { type: 'sender', operator: 'contains', value: 'subscribe' },
    ],
    actions: [
      { type: 'moveTo', value: 'Newsletters' },
      { type: 'markAsRead', value: true },
    ],
    active: true,
    matchCount: 145,
    lastExecuted: '30 minutes ago',
  },
  {
    id: '3',
    name: 'Auto-archive receipts',
    description: 'Archive receipt and transaction emails',
    conditions: [
      { type: 'subject', operator: 'contains', value: 'receipt' },
      { type: 'subject', operator: 'contains', value: 'transaction' },
      { type: 'subject', operator: 'contains', value: 'invoice' },
    ],
    actions: [
      { type: 'moveTo', value: 'Archive' },
      { type: 'addLabel', value: 'Finance' },
    ],
    active: false,
    matchCount: 57,
    lastExecuted: '1 day ago',
  },
  {
    id: '4',
    name: 'Social media alerts',
    description: 'Organize social media notifications',
    conditions: [
      { type: 'sender', operator: 'contains', value: 'facebook.com' },
      { type: 'sender', operator: 'contains', value: 'twitter.com' },
      { type: 'sender', operator: 'contains', value: 'instagram.com' },
      { type: 'sender', operator: 'contains', value: 'linkedin.com' },
    ],
    actions: [{ type: 'addLabel', value: 'Social' }],
    active: true,
    matchCount: 92,
    lastExecuted: '15 minutes ago',
  },
];

// Types for conditions and actions
type ConditionType = 'sender' | 'recipient' | 'subject' | 'body' | 'hasAttachment';
type ConditionOperator = 'contains' | 'notContains' | 'equals' | 'notEquals' | 'matches';
type ActionType = 'moveTo' | 'addLabel' | 'markAsRead' | 'markAsImportant' | 'forward' | 'delete';

interface Condition {
  type: ConditionType;
  operator: ConditionOperator;
  value: string;
}

interface Action {
  type: ActionType;
  value: any;
}

interface Filter {
  id: string;
  name: string;
  description: string;
  conditions: Condition[];
  actions: Action[];
  active: boolean;
  matchCount: number;
  lastExecuted: string;
}

const FiltersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<Filter[]>(mockFilters);

  const filteredFilters = filters.filter(
    filter =>
      filter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      filter.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleFilter = (filterId: string) => {
    setFilters(
      filters.map(filter =>
        filter.id === filterId ? { ...filter, active: !filter.active } : filter
      )
    );
  };

  const handleDeleteFilter = (filterId: string) => {
    setFilters(filters.filter(filter => filter.id !== filterId));
  };

  const handleDuplicateFilter = (filterId: string) => {
    const filterToDuplicate = filters.find(filter => filter.id === filterId);
    if (filterToDuplicate) {
      const newFilter = {
        ...filterToDuplicate,
        id: Date.now().toString(),
        name: `${filterToDuplicate.name} (Copy)`,
        active: false,
      };
      setFilters([...filters, newFilter]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Email Filters</h1>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" />
          Create Filter
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Manage Filters</CardTitle>
            <div className="w-72">
              <Input
                placeholder="Search filters..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full"
                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </div>
          <CardDescription>
            Create and manage rules to automatically organize your emails
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFilters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No filters found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? 'No filters match your search query.'
                  : "You haven't created any filters yet."}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>Create your first filter</Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredFilters.map(filter => (
                <div key={filter.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-medium">{filter.name}</h3>
                        <Badge variant={filter.active ? 'default' : 'outline'}>
                          {filter.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{filter.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <div className="text-xs bg-muted px-2 py-1 rounded-md flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>Matched {filter.matchCount} emails</span>
                        </div>
                        <div className="text-xs bg-muted px-2 py-1 rounded-md">
                          Last run {filter.lastExecuted}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {filter.active ? 'On' : 'Off'}
                        </span>
                        <Switch
                          checked={filter.active}
                          onCheckedChange={() => handleToggleFilter(filter.id)}
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                            <Filter className="h-4 w-4 mr-2" />
                            Edit filter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateFilter(filter.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteFilter(filter.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Conditions</h4>
                      <div className="space-y-2">
                        {filter.conditions.map((condition, index) => (
                          <div key={index} className="text-sm p-2 bg-muted/50 rounded-md">
                            <span className="font-medium capitalize">{condition.type}</span>{' '}
                            <span className="text-muted-foreground">
                              {condition.operator.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>{' '}
                            <span className="font-medium">"{condition.value}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Actions</h4>
                      <div className="space-y-2">
                        {filter.actions.map((action, index) => (
                          <div key={index} className="text-sm p-2 bg-muted/50 rounded-md">
                            <span className="font-medium capitalize">
                              {action.type.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </span>{' '}
                            {typeof action.value === 'boolean' ? (
                              action.value ? (
                                'Yes'
                              ) : (
                                'No'
                              )
                            ) : (
                              <span className="font-medium">"{action.value}"</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Filter Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Filter</DialogTitle>
            <DialogDescription>
              Set up rules to automatically organize your incoming emails.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <label htmlFor="filter-name" className="text-sm font-medium">
                Filter Name
              </label>
              <Input id="filter-name" placeholder="Name your filter" />
            </div>

            <div className="grid gap-2">
              <label htmlFor="filter-description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Input id="filter-description" placeholder="What does this filter do?" />
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Conditions</h3>
              <div className="space-y-3 border p-3 rounded-md">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sender">From</SelectItem>
                        <SelectItem value="recipient">To</SelectItem>
                        <SelectItem value="subject">Subject</SelectItem>
                        <SelectItem value="body">Email body</SelectItem>
                        <SelectItem value="hasAttachment">Has attachment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="notContains">Doesn't contain</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="notEquals">Doesn't equal</SelectItem>
                        <SelectItem value="matches">Matches regex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5">
                    <Input placeholder="Value" />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <Plus className="h-3 w-3" />
                  Add Condition
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Actions</h3>
              <div className="space-y-3 border p-3 rounded-md">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moveTo">Move to folder</SelectItem>
                        <SelectItem value="addLabel">Add label</SelectItem>
                        <SelectItem value="markAsRead">Mark as read</SelectItem>
                        <SelectItem value="markAsImportant">Mark as important</SelectItem>
                        <SelectItem value="forward">Forward to</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-7">
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbox">Inbox</SelectItem>
                        <SelectItem value="archive">Archive</SelectItem>
                        <SelectItem value="trash">Trash</SelectItem>
                        <SelectItem value="spam">Spam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <Plus className="h-3 w-3" />
                  Add Action
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="filter-active" defaultChecked />
              <label htmlFor="filter-active" className="text-sm font-medium">
                Filter active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FiltersPage;
