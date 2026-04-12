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

export const GET_EMAIL_TEMPLATE = gql`
  query GetEmailTemplate($id: String!) {
    getEmailTemplate(id: $id) {
      id
      name
      subject
      body
      userId
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_EMAIL_TEMPLATE = gql`
  mutation CreateTemplate($createTemplateInput: CreateTemplateInput!) {
    createTemplate(createTemplateInput: $createTemplateInput) {
      id
      name
      subject
      body
      updatedAt
    }
  }
`;

export const UPDATE_EMAIL_TEMPLATE = gql`
  mutation UpdateTemplate($updateTemplateInput: UpdateTemplateInput!) {
    updateTemplate(updateTemplateInput: $updateTemplateInput) {
      id
      name
      subject
      body
      updatedAt
    }
  }
`;

export const DELETE_EMAIL_TEMPLATE = gql`
  mutation DeleteTemplate($id: String!) {
    deleteTemplate(id: $id) {
      id
    }
  }
`;
