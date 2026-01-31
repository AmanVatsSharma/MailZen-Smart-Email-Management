export type EmailImportance = 'high' | 'normal' | 'low';
export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | string;
export type EmailStatus = 'read' | 'unread';

export interface EmailAttachment {
  id: string;
  name: string;
  type: string;
  size: number; // size in bytes
  url?: string;
}

export interface EmailParticipant {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailParticipant[];
  lastMessageDate: string;
  isUnread: boolean;
  messages: Email[];
  folder: EmailFolder;
  labelIds?: string[];
  providerId: string;
  providerThreadId?: string;
}

export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: EmailParticipant;
  to: EmailParticipant[];
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  content: string;
  contentPreview: string;
  date: string;
  folder: EmailFolder;
  isStarred: boolean;
  importance: EmailImportance;
  attachments: EmailAttachment[];
  status: EmailStatus;
  labelIds?: string[];
  providerId: string;
  providerEmailId?: string;
}

export interface EmailLabel {
  id: string;
  name: string;
  color: string;
  providerId?: string;
  isSystem?: boolean;
}

export interface PaginatedEmails {
  items: EmailThread[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface EmailFilter {
  search?: string;
  folder?: EmailFolder;
  labelIds?: string[];
  status?: EmailStatus;
  dateFrom?: string;
  dateTo?: string;
  isStarred?: boolean;
  hasAttachments?: boolean;
  from?: string;
  to?: string;
  providerId?: string;
}

export interface EmailSortOption {
  field: 'date' | 'from' | 'subject' | 'importance';
  direction: 'asc' | 'desc';
} 