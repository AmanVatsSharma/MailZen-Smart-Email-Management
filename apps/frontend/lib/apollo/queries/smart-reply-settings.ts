import { gql } from '@apollo/client';

export const GET_SMART_REPLY_SETTINGS = gql`
  query GetSmartReplySettings {
    smartReplySettings {
      id
      userId
      enabled
      defaultTone
      defaultLength
      aiModel
      includeSignature
      personalization
      creativityLevel
      maxSuggestions
      customInstructions
      keepHistory
      historyLength
      updatedAt
    }
  }
`;

export const UPDATE_SMART_REPLY_SETTINGS = gql`
  mutation UpdateSmartReplySettings($input: UpdateSmartReplySettingsInput!) {
    updateSmartReplySettings(input: $input) {
      id
      enabled
      defaultTone
      defaultLength
      aiModel
      includeSignature
      personalization
      creativityLevel
      maxSuggestions
      customInstructions
      keepHistory
      historyLength
      updatedAt
    }
  }
`;
