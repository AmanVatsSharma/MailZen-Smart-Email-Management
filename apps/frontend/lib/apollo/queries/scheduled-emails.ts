import { gql } from '@apollo/client';

export const GET_ALL_SCHEDULED_EMAILS = gql`
  query GetAllScheduledEmails {
    getAllScheduledEmails {
      id
      subject
      body
      recipientIds
      scheduledAt
      status
    }
  }
`;
