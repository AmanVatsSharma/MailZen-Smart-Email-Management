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

export const GET_EMAIL_TRACKING_STATS = gql`
  query GetEmailTrackingStats {
    getAllEmailAnalytics {
      id
      emailId
      openCount
      clickCount
      lastUpdatedAt
    }
  }
`;
