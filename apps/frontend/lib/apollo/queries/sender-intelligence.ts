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

export const GET_VIP_SENDERS = gql`
  query VipSenders {
    vipSenders {
      senderEmail
      displayName
      emailCount
      relationshipScore
      isVip
      lastEmailAt
    }
  }
`;

export const SET_SENDER_VIP = gql`
  mutation SetSenderVip($email: String!, $isVip: Boolean!) {
    setSenderVip(email: $email, isVip: $isVip) {
      senderEmail
      displayName
      isVip
      relationshipScore
    }
  }
`;
