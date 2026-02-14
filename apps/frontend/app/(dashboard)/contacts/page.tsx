'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Plus, Search, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
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
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  CREATE_CONTACT,
  DELETE_CONTACT,
  GET_ALL_CONTACTS,
  UPDATE_CONTACT,
} from '@/lib/apollo/queries/contacts';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';

type Contact = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string;
};

type ContactForm = {
  name: string;
  email: string;
  phone: string;
};

const EMPTY_FORM: ContactForm = {
  name: '',
  email: '',
  phone: '',
};

const ContactsPage = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);

  const { data, loading, error, refetch } = useQuery(GET_ALL_CONTACTS, {
    fetchPolicy: 'network-only',
  });

  const [createContact, { loading: createLoading }] = useMutation(CREATE_CONTACT, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Contact created',
        description: 'New contact saved successfully.',
      });
    },
  });

  const [updateContact, { loading: updateLoading }] = useMutation(UPDATE_CONTACT, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Contact updated',
        description: 'Contact changes saved successfully.',
      });
    },
  });

  const [deleteContact] = useMutation(DELETE_CONTACT, {
    onCompleted: async () => {
      await refetch();
      toast({
        title: 'Contact deleted',
        description: 'The contact has been removed.',
      });
    },
  });

  const contacts = useMemo<Contact[]>(() => data?.getAllContacts ?? [], [data]);
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.email, contact.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [contacts, searchQuery]);

  const openCreateDialog = () => {
    setEditingContactId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContactId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name || !email) {
      toast({
        title: 'Missing required fields',
        description: 'Name and email are required.',
        variant: 'destructive',
      });
      return;
    }

    if (editingContactId) {
      await updateContact({
        variables: {
          updateContactInput: {
            id: editingContactId,
            name,
            email,
            phone: phone || undefined,
          },
        },
      });
    } else {
      await createContact({
        variables: {
          createContactInput: {
            name,
            email,
            phone: phone || undefined,
          },
        },
      });
    }

    setDialogOpen(false);
    setEditingContactId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = async (contact: Contact) => {
    const confirmed = window.confirm(
      `Delete contact "${contact.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    await deleteContact({
      variables: { id: contact.id },
    });
  };

  const isSaving = createLoading || updateLoading;

  return (
    <DashboardPageShell
      title="Contacts"
      description="Manage recipients synced with backend resolvers."
      actions={(
        <Button onClick={openCreateDialog} className="gap-1">
          <Plus className="h-4 w-4" />
          New Contact
        </Button>
      )}
      contentClassName="space-y-4"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Address Book</CardTitle>
              <CardDescription>
                {filteredContacts.length} contact{filteredContacts.length === 1 ? '' : 's'}
              </CardDescription>
            </div>
            <div className="w-full max-w-sm">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search contacts..."
                prefix={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading contacts...</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              Failed to load contacts: {error.message}
            </p>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No contacts found. Add your first contact to start composing faster.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium truncate">{contact.name}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {contact.email}
                      </span>
                      {contact.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(contact)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingContactId ? 'Edit Contact' : 'New Contact'}</DialogTitle>
            <DialogDescription>
              {editingContactId
                ? 'Update contact details and save changes.'
                : 'Create a contact that can be reused while composing emails.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="contact-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="contact-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="contact-phone" className="text-sm font-medium">
                Phone (optional)
              </label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="+1 555 123 4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPageShell>
  );
};

export default ContactsPage;
