import { gql } from '@apollo/client';

export const GET_MY_NOTIFICATIONS = gql`
  query MyNotifications($limit: Int, $unreadOnly: Boolean) {
    myNotifications(limit: $limit, unreadOnly: $unreadOnly) {
      id
      type
      title
      message
      isRead
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

