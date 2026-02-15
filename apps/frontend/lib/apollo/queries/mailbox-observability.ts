import { gql } from '@apollo/client';

export const GET_MY_MAILBOX_INBOUND_EVENTS = gql`
  query MyMailboxInboundEvents($mailboxId: String, $status: String, $limit: Int) {
    myMailboxInboundEvents(mailboxId: $mailboxId, status: $status, limit: $limit) {
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
  query MyMailboxInboundEventStats($mailboxId: String, $windowHours: Int) {
    myMailboxInboundEventStats(mailboxId: $mailboxId, windowHours: $windowHours) {
      mailboxId
      mailboxEmail
      windowHours
      totalCount
      acceptedCount
      deduplicatedCount
      rejectedCount
      lastProcessedAt
    }
  }
`;
