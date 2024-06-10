import { gql } from '@apollo/client';

// Query to get all emails
export const GET_EMAILS = gql`
  query GetEmails($limit: Int, $offset: Int, $filter: EmailFilterInput) {
    emails(limit: $limit, offset: $offset, filter: $filter) {
      id
      subject
      sender {
        name
        email
      }
      receiver {
        name
        email
      }
      content
      timestamp
      read
      starred
      labels
      attachments {
        id
        name
        size
        type
      }
      folder
    }
  }
`;

// Query to get a single email by ID
export const GET_EMAIL = gql`
  query GetEmail($id: ID!) {
    email(id: $id) {
      id
      subject
      sender {
        name
        email
      }
      receiver {
        name
        email
      }
      content
      timestamp
      read
      starred
      labels
      attachments {
        id
        name
        size
        type
      }
      folder
      thread {
        id
        subject
      }
    }
  }
`;

// Mutation to update email status
export const UPDATE_EMAIL = gql`
  mutation UpdateEmail($id: ID!, $input: EmailUpdateInput!) {
    updateEmail(id: $id, input: $input) {
      id
      read
      starred
      labels
      folder
    }
  }
`;

// Mutation to send an email
export const SEND_EMAIL = gql`
  mutation SendEmail($input: EmailSendInput!) {
    sendEmail(input: $input) {
      id
      subject
      sender {
        name
        email
      }
      receiver {
        name
        email
      }
      content
      timestamp
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
