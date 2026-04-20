/**
 * File:        apps/frontend/lib/apollo/queries/emails.ts
 * Module:      Email · Apollo GraphQL Operations
 * Purpose:     Centralises all GQL query and mutation documents for email threads,
 *              labels, folders, and triage actions used across the frontend.
 *
 * Exports:
 *   - GET_EMAILS           — paginated email-thread listing query
 *   - GET_EMAIL            — single thread by ID query
 *   - UPDATE_EMAIL         — mutation to update folder/starred/labelIds on a thread
 *   - SEND_EMAIL           — mutation to persist and dispatch an outbound email
 *   - GET_FOLDERS          — query for folder list with counts
 *   - GET_LABELS           — query for workspace label list (name/color/count)
 *   - GET_ALL_LABELS       — query for organisation-level labels (id/name) used for ID lookup
 *   - UNSUBSCRIBE_FROM_SENDER — mutation to archive a thread and suppress its sender
 *   - CREATE_LABEL         — mutation to create a new label by name
 *
 * Depends on:
 *   - @apollo/client — gql tag for document nodes
 *
 * Side-effects:
 *   - none (document constants only)
 *
 * Key invariants:
 *   - UPDATE_EMAIL id param is the EmailThread id (not a message id)
 *   - UNSUBSCRIBE_FROM_SENDER is wired to the email.resolver unsubscribeFromSender mutation
 *     which will only appear in schema.gql after backend rebuilds
 *   - GET_ALL_LABELS targets getAllLabels (organisation resolver); GET_LABELS targets labels
 *     (unified-inbox resolver with count)
 *
 * Read order:
 *   1. GET_EMAILS / GET_EMAIL   — read queries
 *   2. UPDATE_EMAIL             — core thread-update mutation
 *   3. UNSUBSCRIBE_FROM_SENDER  — triage unsubscribe mutation
 *   4. CREATE_LABEL             — label creation for triage apply-label flow
 *   5. GET_LABELS / GET_ALL_LABELS / GET_FOLDERS — supporting queries
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { gql } from '@apollo/client';

// Query to get all emails — returns paginated wrapper with items + totalCount
export const GET_EMAILS = gql`
  query GetEmails($limit: Int, $offset: Int, $filter: EmailFilterInput, $sort: EmailSortInput) {
    emails(limit: $limit, offset: $offset, filter: $filter, sort: $sort) {
      totalCount
      items {
        id
        subject
        participants {
          name
          email
          avatar
        }
        lastMessageDate
        isUnread
        folder
        labelIds
        providerId
        providerThreadId
        messages {
          id
          threadId
          subject
          from {
            name
            email
            avatar
          }
          to {
            name
            email
            avatar
          }
          cc {
            name
            email
            avatar
          }
          bcc {
            name
            email
            avatar
          }
          content
          contentPreview
          date
          folder
          isStarred
          importance
          attachments {
            id
            name
            size
            type
            url
          }
          status
          labelIds
          providerId
          providerEmailId
        }
      }
    }
  }
`;

// Query to get a single email by ID
export const GET_EMAIL = gql`
  query GetEmail($id: String!) {
    email(id: $id) {
      id
      subject
      participants {
        name
        email
        avatar
      }
      lastMessageDate
      isUnread
      folder
      labelIds
      providerId
      providerThreadId
      messages {
        id
        threadId
        subject
        from {
          name
          email
          avatar
        }
        to {
          name
          email
          avatar
        }
        cc {
          name
          email
          avatar
        }
        bcc {
          name
          email
          avatar
        }
        content
        contentPreview
        date
        folder
        isStarred
        importance
        attachments {
          id
          name
          size
          type
          url
        }
        status
        labelIds
        providerId
        providerEmailId
      }
    }
  }
`;

// Mutation to update email status
export const UPDATE_EMAIL = gql`
  mutation UpdateEmail($id: String!, $input: EmailUpdateInput!) {
    updateEmail(id: $id, input: $input) {
      id
      folder
      labelIds
      isUnread
      lastMessageDate
      messages {
        id
        isStarred
        status
        labelIds
        folder
      }
    }
  }
`;

// Mutation to send an email
export const SEND_EMAIL = gql`
  mutation SendEmail($input: SendEmailInput!) {
    sendEmail(input: $input) {
      id
      subject
      body
      from
      to
      status
      createdAt
    }
  }
`;

// Query to get email folders
export const GET_FOLDERS = gql`
  query GetFolders {
    folders {
      id
      name
      count
      unreadCount
    }
  }
`;

// Query to get email labels
export const GET_LABELS = gql`
  query GetLabels {
    labels {
      id
      name
      color
      count
    }
  }
`;

// Query to get all organisation-level labels — used for name→id lookup in triage
export const GET_ALL_LABELS = gql`
  query GetAllLabels {
    getAllLabels {
      id
      name
      color
    }
  }
`;

// Mutation to unsubscribe from a sender: archives the thread and suppresses future mail
export const UNSUBSCRIBE_FROM_SENDER = gql`
  mutation UnsubscribeFromSender($emailId: String!) {
    unsubscribeFromSender(emailId: $emailId) {
      success
      senderEmail
    }
  }
`;

// Mutation to create a label by name — used as a fallback in the triage apply-label flow
export const CREATE_LABEL = gql`
  mutation CreateLabel($name: String!, $color: String) {
    createLabel(createLabelInput: { name: $name, color: $color }) {
      id
      name
      color
    }
  }
`;
