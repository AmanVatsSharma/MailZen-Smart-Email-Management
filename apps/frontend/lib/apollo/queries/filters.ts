import { gql } from '@apollo/client';

export const GET_EMAIL_FILTERS = gql`
  query GetEmailFilters {
    getEmailFilters
  }
`;

export const CREATE_EMAIL_FILTER = gql`
  mutation CreateEmailFilter($input: CreateEmailFilterInput!) {
    createEmailFilter(input: $input)
  }
`;

export const DELETE_EMAIL_FILTER = gql`
  mutation DeleteEmailFilter($id: String!) {
    deleteEmailFilter(id: $id)
  }
`;
