'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  UserPlus,
  Upload,
  Download,
  MoreHorizontal,
  Mail,
  Phone,
  Star,
  StarOff,
  Trash2,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock contact data for demonstration
const mockContacts = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    company: 'Acme Inc.',
    isFavorite: true,
    avatar: null,
    lastContacted: '2 days ago',
    group: 'Work',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phone: '+1 (555) 987-6543',
    company: 'Globex Corp',
    isFavorite: false,
    avatar: null,
    lastContacted: '1 week ago',
    group: 'Work',
  },
  {
    id: '3',
    name: 'Michael Brown',
    email: 'mbrown@example.com',
    phone: '+1 (555) 456-7890',
    company: 'Personal',
    isFavorite: true,
    avatar: null,
    lastContacted: '3 days ago',
    group: 'Personal',
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '+1 (555) 789-0123',
    company: 'Tech Solutions',
    isFavorite: false,
    avatar: null,
    lastContacted: 'Yesterday',
    group: 'Work',
  },
  {
    id: '5',
    name: 'David Wilson',
    email: 'david@example.com',
    phone: '+1 (555) 234-5678',
    company: 'Personal',
    isFavorite: false,
    avatar: null,
    lastContacted: '2 weeks ago',
    group: 'Personal',
  },
];

// Contact groups
const contactGroups = [
  { id: '1', name: 'All', count: 5 },
  { id: '2', name: 'Work', count: 3 },
  { id: '3', name: 'Personal', count: 2 },
];

const ContactsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newContactDialogOpen, setNewContactDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState('All');

  const filteredContacts = mockContacts.filter(contact => {
    // Filter by search query
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter by group
    const matchesGroup = activeGroup === 'All' || contact.group === activeGroup;

    return matchesSearch && matchesGroup;
  });

  const getSelectedContact = () => {
    return mockContacts.find(contact => contact.id === selectedContactId) || null;
  };

  const handleToggleFavorite = (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real app, this would update the contact's favorite status in the database
    console.log('Toggle favorite for contact:', contactId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            className="gap-1"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setNewContactDialogOpen(true)} className="gap-1">
            <UserPlus className="h-4 w-4" />
            New Contact
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
        {/* Sidebar */}
        <div className="md:col-span-1 flex flex-col h-full">
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <Input
                placeholder="Search contacts..."
                className="w-full"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {contactGroups.map(group => (
                  <Button
                    key={group.id}
                    variant={activeGroup === group.name ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setActiveGroup(group.name)}
                  >
                    {group.name}
                    <span className="ml-auto bg-muted rounded-full px-2 py-0.5 text-xs">
                      {group.count}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
            <CardFooter className="border-t p-3">
              <Button variant="ghost" size="sm" className="w-full gap-1">
                <Plus className="h-4 w-4" />
                New Group
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Contact List */}
        <div className="md:col-span-3 flex flex-col h-full">
          <Card className="flex-1">
            <CardHeader className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {activeGroup} Contacts ({filteredContacts.length})
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" title="Export contacts">
                    <Download className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Select all</DropdownMenuItem>
                      <DropdownMenuItem>Sort by name</DropdownMenuItem>
                      <DropdownMenuItem>Sort by recently contacted</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Delete selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">No contacts found</h3>
                  <p className="text-muted-foreground mb-4">
                    We couldn't find any contacts matching your search.
                  </p>
                  <Button onClick={() => setNewContactDialogOpen(true)}>Add a new contact</Button>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredContacts.map(contact => (
                    <div
                      key={contact.id}
                      className="flex items-center p-4 hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedContactId(contact.id)}
                    >
                      <Avatar className="h-10 w-10 mr-4">
                        <div className="bg-primary text-primary-foreground w-full h-full flex items-center justify-center text-lg font-medium">
                          {contact.name.charAt(0)}
                        </div>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <div className="font-medium truncate">{contact.name}</div>
                          <button
                            className="ml-2 focus:outline-none"
                            onClick={e => handleToggleFavorite(contact.id, e)}
                            aria-label={
                              contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'
                            }
                          >
                            {contact.isFavorite ? (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {contact.email}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{contact.company}</span>
                          <span>•</span>
                          <span>Last contacted {contact.lastContacted}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Email contact"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Call contact"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Star className="h-4 w-4 mr-2" />
                              {contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Contact Dialog */}
      <Dialog open={newContactDialogOpen} onOpenChange={setNewContactDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>Create a new contact to add to your address book.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input id="name" placeholder="Full name" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input id="email" type="email" placeholder="Email address" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <Input id="phone" placeholder="Phone number" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="company" className="text-sm font-medium">
                Company / Organization
              </label>
              <Input id="company" placeholder="Company name" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="group" className="text-sm font-medium">
                Group
              </label>
              <select
                id="group"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a group</option>
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Contacts Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>Import contacts from a CSV or vCard file.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Tabs defaultValue="csv">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="csv">CSV File</TabsTrigger>
                <TabsTrigger value="vcard">vCard</TabsTrigger>
              </TabsList>
              <TabsContent value="csv" className="pt-4">
                <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center">
                  <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Drop your CSV file here</h3>
                  <p className="text-xs text-muted-foreground mb-2">or</p>
                  <Button size="sm">Select File</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your CSV file should include columns for name, email, phone, and company.
                </p>
              </TabsContent>
              <TabsContent value="vcard" className="pt-4">
                <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center">
                  <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Drop your vCard file here</h3>
                  <p className="text-xs text-muted-foreground mb-2">or</p>
                  <Button size="sm">Select File</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Import contacts from a .vcf file exported from another email client.
                </p>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactsPage;
