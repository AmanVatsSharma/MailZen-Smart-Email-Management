import { gql } from '@apollo/client';

export const GET_TOP_SENDERS = gql`
  query GetTopSenders($limit: Int) {
    topSenders(limit: $limit) {
      senderEmail
      displayName
      emailCount
      relationshipScore
      isVip
      lastEmailAt
    }
  }
`;

export const GET_SENDER_PROFILE = gql`
  query GetSenderProfile($email: String!) {
    senderProfile(email: $email) {
      senderEmail
      displayName
      emailCount
      relationshipScore
      isVip
      topics
      avgResponseTimeHours
      lastEmailAt
    }
  }
`;
