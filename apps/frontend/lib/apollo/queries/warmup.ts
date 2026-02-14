import { gql } from '@apollo/client';

export const GET_EMAIL_WARMUP_STATUS = gql`
  query GetEmailWarmupStatus($providerId: String!) {
    getEmailWarmupStatus(providerId: $providerId) {
      id
      providerId
      status
      currentDailyLimit
      dailyIncrement
      maxDailyEmails
      minimumInterval
      targetOpenRate
      startedAt
      lastRunAt
      activities {
        id
        warmupId
        emailsSent
        openRate
        date
      }
    }
  }
`;

export const GET_WARMUP_PERFORMANCE_METRICS = gql`
  query GetWarmupPerformanceMetrics($warmupId: String!) {
    getWarmupPerformanceMetrics(warmupId: $warmupId) {
      averageOpenRate
      totalEmailsSent
      daysActive
      currentPhase
    }
  }
`;

export const START_EMAIL_WARMUP = gql`
  mutation StartEmailWarmup($input: StartWarmupInput!) {
    startEmailWarmup(input: $input) {
      id
      providerId
      status
      currentDailyLimit
      maxDailyEmails
      dailyIncrement
      minimumInterval
      targetOpenRate
      startedAt
      lastRunAt
    }
  }
`;

export const PAUSE_EMAIL_WARMUP = gql`
  mutation PauseEmailWarmup($input: PauseWarmupInput!) {
    pauseEmailWarmup(input: $input) {
      id
      providerId
      status
      currentDailyLimit
      maxDailyEmails
      dailyIncrement
      minimumInterval
      targetOpenRate
      startedAt
      lastRunAt
    }
  }
`;
