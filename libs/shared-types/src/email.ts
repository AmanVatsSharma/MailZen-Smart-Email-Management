/**
 * Core email domain types shared between frontend (Apollo models) and
 * backend (UnifiedInbox service layer).
 */

export type EmailFolder =
  | 'inbox'
  | 'sent'
  | 'drafts'
  | 'trash'
  | 'spam'
  | 'archive';

export type EmailStatus = 'read' | 'unread';

export type EmailImportance = 'high' | 'normal' | 'low';

export type EmailSortField = 'date' | 'from' | 'subject' | 'importance';
export type SortDirection = 'asc' | 'desc';

export interface EmailParticipant {
  name: string;
  email: string;
  avatar?: string | null;
}

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string | null;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: EmailParticipant;
  to: EmailParticipant[];
  cc?: EmailParticipant[] | null;
  bcc?: EmailParticipant[] | null;
  content: string;
  contentPreview: string;
  date: string;
  folder: EmailFolder;
  isStarred: boolean;
  importance: EmailImportance;
  attachments: EmailAttachment[];
  status: EmailStatus;
  labelIds?: string[] | null;
  providerId?: string | null;
  providerEmailId?: string | null;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailParticipant[];
  lastMessageDate: string;
  isUnread: boolean;
  messages: EmailMessage[];
  folder: EmailFolder;
  labelIds?: string[] | null;
  providerId?: string | null;
  providerThreadId?: string | null;
}

export interface PaginatedEmailThreads {
  items: EmailThread[];
  totalCount: number;
}

export interface EmailFilterInput {
  folder?: EmailFolder | null;
  search?: string | null;
  labelIds?: string[] | null;
  status?: EmailStatus | null;
  isStarred?: boolean | null;
  providerId?: string | null;
}

export interface EmailSortInput {
  field: EmailSortField;
  direction: SortDirection;
}

/**
 * AI label prefixes written by EmailAiProcessorService.
 * Format: "ai:<classification>" | "ai:priority_<level>"
 */
export type AiClassificationLabel =
  | 'ai:urgent_issue'
  | 'ai:coordination'
  | 'ai:commercial'
  | 'ai:status_tracking'
  | 'ai:support'
  | 'ai:general';

export type AiPriorityLabel =
  | 'ai:priority_high'
  | 'ai:priority_medium'
  | 'ai:priority_low';

export type AiLabel = AiClassificationLabel | AiPriorityLabel;

export function isAiLabel(label: string): label is AiLabel {
  return label.startsWith('ai:');
}

export function isAiPriorityLabel(label: string): label is AiPriorityLabel {
  return (
    label === 'ai:priority_high' ||
    label === 'ai:priority_medium' ||
    label === 'ai:priority_low'
  );
}
