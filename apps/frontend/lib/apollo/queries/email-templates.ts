import { gql } from '@apollo/client';

export const GET_EMAIL_TEMPLATES = gql`
  query GetEmailTemplates {
    getEmailTemplates {
      id
      name
      subject
      body
      updatedAt
    }
  }
`;

export const RENDER_EMAIL_TEMPLATE = gql`
  query RenderEmailTemplate($id: String!, $variables: String) {
    renderEmailTemplate(id: $id, variables: $variables)
  }
`;
