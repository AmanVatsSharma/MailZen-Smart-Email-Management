/**
 * File:        apps/frontend/app/(dashboard)/contacts/page.tsx
 * Module:      Contacts · Address Book
 * Purpose:     Full-featured address book with create, edit, delete, and search.
 *              Contacts auto-complete when composing emails.
 *
 * Exports:
 *   - ContactsPage (default) — address book page with CRUD dialogs
 *
 * Depends on:
 *   - GET_ALL_CONTACTS, CREATE_CONTACT, UPDATE_CONTACT, DELETE_CONTACT
 *   - DashboardPageShell — standard page wrapper
 *   - AlertDialog — confirmation on destructive delete action
 *
 * Side-effects:
 *   - Apollo: reads contacts list, writes via create/update/delete mutations
 *
 * Key invariants:
 *   - Delete confirmation uses AlertDialog (never window.confirm — no styling control)
 *   - Avatar color is deterministic: same name always hashes to the same accent
 *
 * Read order:
 *   1. getAvatarColor — color hash utility
 *   2. ContactRow     — row component
 *   3. ContactsPage   — main page with query/mutation wiring
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-07
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { BookUser, Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  CREATE_CONTACT,
  DELETE_CONTACT,
  GET_ALL_CONTACTS,
  UPDATE_CONTACT,
} from '@/lib/apollo/queries/contacts';
import { DashboardPageShell } from '@/components/layout/DashboardPageShell';
import { cn } from '@/lib/tokens/cn';

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

const EMPTY_FORM: ContactForm = { name: '', email: '', phone: '' };

const AVATAR_COLORS = [
  'bg-violet-500/15 text-violet-500',
  'bg-blue-500/15 text-blue-500',
  'bg-emerald-500/15 text-emerald-500',
  'bg-orange-500/15 text-orange-500',
  'bg-pink-500/15 text-pink-500',
  'bg-cyan-500/15 text-cyan-500',
  'bg-amber-500/15 text-amber-500',
  'bg-rose-500/15 text-rose-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ContactSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-52" />
      </div>
      <Skeleton className="h-7 w-16 rounded-md" />
    </div>
  );
}

const ContactsPage = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);

  const { data, loading, error, refetch } = useQuery(GET_ALL_CONTACTS, {
    fetchPolicy: 'cache-and-network',
  });

  const [createContact, { loading: createLoading }] = useMutation(CREATE_CONTACT, {
    onCompleted: async () => {
      await refetch();
      toast({ title: 'Contact added', description: 'Saved to your address book.' });
    },
  });

  const [updateContact, { loading: updateLoading }] = useMutation(UPDATE_CONTACT, {
    onCompleted: async () => {
      await refetch();
      toast({ title: 'Contact updated', description: 'Changes saved.' });
    },
  });

  const [deleteContact, { loading: deleteLoading }] = useMutation(DELETE_CONTACT, {
    onCompleted: async () => {
      await refetch();
      setDeleteTarget(null);
      toast({ title: 'Contact removed', description: 'Deleted from your address book.' });
    },
  });

  const contacts = useMemo<Contact[]>(() => data?.getAllContacts ?? [], [data]);
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.phone ?? ''].join(' ').toLowerCase().includes(q),
    );
  }, [contacts, searchQuery]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setForm({ name: contact.name, email: contact.email, phone: contact.phone ?? '' });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim() || undefined;

    if (!name || !email) {
      toast({ title: 'Missing fields', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }

    if (editingId) {
      await updateContact({ variables: { updateContactInput: { id: editingId, name, email, phone } } });
    } else {
      await createContact({ variables: { createContactInput: { name, email, phone } } });
    }

    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const isSaving = createLoading || updateLoading;

  return (
    <DashboardPageShell
      title="Contacts"
      description="Your personal address book — reused for auto-complete when composing."
      actions={
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Contact
        </Button>
      }
      contentClassName="space-y-4"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Address Book</span>
              {!loading && (
                <Badge variant="secondary" className="text-xs">
                  {contacts.length}
                </Badge>
              )}
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or phone…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => <ContactSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-destructive">Failed to load contacts: {error.message}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <BookUser className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {searchQuery ? 'No contacts match your search' : 'No contacts yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {searchQuery
                    ? 'Try a different name or email address.'
                    : 'Add a contact to speed up composing — names auto-complete as you type.'}
                </p>
              </div>
              {!searchQuery && (
                <Button size="sm" variant="outline" onClick={openCreate} className="mt-1 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add your first contact
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((contact) => {
                const initials = getInitials(contact.name);
                const avatarColor = getAvatarColor(contact.name);
                return (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', avatarColor)}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{contact.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{contact.email}</span>
                        </span>
                        {contact.phone && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit contact"
                        onClick={() => openEdit(contact)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete contact"
                        onClick={() => setDeleteTarget(contact)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Contact' : 'New Contact'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the contact details below.'
                : 'Add someone to your address book for quick auto-complete when composing.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label htmlFor="contact-name" className="text-sm font-medium">Name</label>
              <Input
                id="contact-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contact-email" className="text-sm font-medium">Email</label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="jane@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contact-phone" className="text-sm font-medium">
                Phone <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) will be permanently
              removed from your address book. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteContact({ variables: { id: deleteTarget!.id } })}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPageShell>
  );
};

export default ContactsPage;
