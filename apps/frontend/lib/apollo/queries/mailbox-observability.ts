import { gql } from '@apollo/client';

export const GET_MY_MAILBOX_INBOUND_EVENTS = gql`
  query MyMailboxInboundEvents(
    $mailboxId: String
    $workspaceId: String
    $status: String
    $limit: Int
  ) {
    myMailboxInboundEvents(
      mailboxId: $mailboxId
      workspaceId: $workspaceId
      status: $status
      limit: $limit
    ) {
      id
      mailboxId
      mailboxEmail
      messageId
      emailId
      inboundThreadKey
      status
      sourceIp
      signatureValidated
      errorReason
      createdAt
    }
  }
`;

export const GET_MY_MAILBOX_INBOUND_EVENT_STATS = gql`
  query MyMailboxInboundEventStats(
    $mailboxId: String
    $workspaceId: String
    $windowHours: Int
  ) {
    myMailboxInboundEventStats(
      mailboxId: $mailboxId
      workspaceId: $workspaceId
      windowHours: $windowHours
    ) {
      mailboxId
      mailboxEmail
      windowHours
      totalCount
      acceptedCount
      deduplicatedCount
      rejectedCount
      successRatePercent
      rejectionRatePercent
      slaTargetSuccessPercent
      slaWarningRejectedPercent
      slaCriticalRejectedPercent
      slaStatus
      meetsSla
      lastProcessedAt
    }
  }
`;

export const GET_MY_MAILBOX_INBOUND_EVENT_SERIES = gql`
  query MyMailboxInboundEventSeries(
    $mailboxId: String
    $workspaceId: String
    $windowHours: Int
    $bucketMinutes: Int
  ) {
    myMailboxInboundEventSeries(
      mailboxId: $mailboxId
      workspaceId: $workspaceId
      windowHours: $windowHours
      bucketMinutes: $bucketMinutes
    ) {
      bucketStart
      totalCount
      acceptedCount
      deduplicatedCount
      rejectedCount
    }
  }
`;
