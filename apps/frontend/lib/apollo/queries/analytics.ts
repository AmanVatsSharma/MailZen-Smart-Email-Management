import { gql } from '@apollo/client';

export const GET_DASHBOARD_ANALYTICS = gql`
  query GetDashboardAnalytics {
    getAllEmailAnalytics {
      id
      emailId
      openCount
      clickCount
      lastUpdatedAt
    }
    getAllScheduledEmails {
      id
      status
      scheduledAt
    }
  }
`;
