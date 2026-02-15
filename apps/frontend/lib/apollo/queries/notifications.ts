import { gql } from '@apollo/client';

export const GET_MY_NOTIFICATIONS = gql`
  query MyNotifications(
    $limit: Int
    $unreadOnly: Boolean
    $workspaceId: String
    $sinceHours: Int
    $types: [String!]
  ) {
    myNotifications(
      limit: $limit
      unreadOnly: $unreadOnly
      workspaceId: $workspaceId
      sinceHours: $sinceHours
      types: $types
    ) {
      id
      type
      title
      message
      isRead
      workspaceId
      metadata
      createdAt
    }
  }
`;

export const GET_UNREAD_NOTIFICATION_COUNT = gql`
  query MyUnreadNotificationCount {
    myUnreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: String!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

export const GET_NOTIFICATION_PREFERENCES = gql`
  query MyNotificationPreferences {
    myNotificationPreferences {
      id
      inAppEnabled
      emailEnabled
      pushEnabled
      syncFailureEnabled
      mailboxInboundAcceptedEnabled
      mailboxInboundDeduplicatedEnabled
      mailboxInboundRejectedEnabled
      mailboxInboundSlaTargetSuccessPercent
      mailboxInboundSlaWarningRejectedPercent
      mailboxInboundSlaCriticalRejectedPercent
      mailboxInboundSlaAlertsEnabled
      updatedAt
    }
  }
`;

export const UPDATE_NOTIFICATION_PREFERENCES = gql`
  mutation UpdateMyNotificationPreferences(
    $input: UpdateNotificationPreferencesInput!
  ) {
    updateMyNotificationPreferences(input: $input) {
      id
      inAppEnabled
      emailEnabled
      pushEnabled
      syncFailureEnabled
      mailboxInboundAcceptedEnabled
      mailboxInboundDeduplicatedEnabled
      mailboxInboundRejectedEnabled
      mailboxInboundSlaTargetSuccessPercent
      mailboxInboundSlaWarningRejectedPercent
      mailboxInboundSlaCriticalRejectedPercent
      mailboxInboundSlaAlertsEnabled
      updatedAt
    }
  }
`;

