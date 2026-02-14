import { gql } from '@apollo/client';

export const GET_MY_INBOXES = gql`
  query MyInboxes {
    myInboxes {
      id
      type
      address
      isActive
      status
    }
  }
`;

export const SET_ACTIVE_INBOX = gql`
  mutation SetActiveInbox($input: SetActiveInboxInput!) {
    setActiveInbox(input: $input) {
      id
      type
      address
      isActive
      status
    }
  }
`;
