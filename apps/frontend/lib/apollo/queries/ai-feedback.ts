import { gql } from '@apollo/client';

export const RECORD_AI_FEEDBACK = gql`
  mutation RecordAiFeedback($input: RecordAiFeedbackInput!) {
    recordAiFeedback(input: $input)
  }
`;
