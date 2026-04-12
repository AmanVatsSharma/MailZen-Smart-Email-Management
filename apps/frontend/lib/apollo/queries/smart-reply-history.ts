import { gql } from '@apollo/client';

export const GET_SMART_REPLY_HISTORY = gql`
  query MySmartReplyHistory($limit: Int) {
    mySmartReplyHistory(limit: $limit) {
      id
      conversationPreview
      suggestions
      source
      blockedSensitive
      fallbackUsed
      createdAt
    }
  }
`;

export const PURGE_SMART_REPLY_HISTORY = gql`
  mutation PurgeMySmartReplyHistory {
    purgeMySmartReplyHistory {
      purgedRows
      executedAtIso
    }
  }
`;

export const GET_SMART_REPLY_DATA_EXPORT = gql`
  query MySmartReplyDataExport($limit: Int) {
    mySmartReplyDataExport(limit: $limit) {
      generatedAtIso
      dataJson
    }
  }
`;

export const GET_SMART_REPLY_PROVIDER_HEALTH = gql`
  query MySmartReplyProviderHealth {
    mySmartReplyProviderHealth {
      mode
      hybridPrimary
      executedAtIso
      providers {
        providerId
        enabled
        configured
        priority
        note
      }
    }
  }
`;
