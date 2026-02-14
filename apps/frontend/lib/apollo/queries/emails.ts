import { gql } from '@apollo/client';

// Query to get all emails
export const GET_EMAILS = gql`
  query GetEmails($limit: Int, $offset: Int, $filter: EmailFilterInput, $sort: EmailSortInput) {
    emails(limit: $limit, offset: $offset, filter: $filter, sort: $sort) {
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
