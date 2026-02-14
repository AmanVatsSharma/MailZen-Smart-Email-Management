import { gql } from '@apollo/client';

export const GET_SUGGESTED_REPLIES = gql`
  query GetSuggestedReplies($emailBody: String!, $count: Int) {
    getSuggestedReplies(emailBody: $emailBody, count: $count)
  }
`;

export const GENERATE_SMART_REPLY = gql`
  query GenerateSmartReply($input: SmartReplyInput!) {
    generateSmartReply(input: $input)
  }
`;

