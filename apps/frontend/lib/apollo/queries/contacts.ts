import { gql } from '@apollo/client';

export const GET_ALL_CONTACTS = gql`
  query GetAllContacts {
    getAllContacts {
      id
      name
      email
      phone
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_CONTACT = gql`
  mutation CreateContact($createContactInput: CreateContactInput!) {
    createContact(createContactInput: $createContactInput) {
      id
      name
      email
      phone
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CONTACT = gql`
  mutation UpdateContact($updateContactInput: UpdateContactInput!) {
    updateContact(updateContactInput: $updateContactInput) {
      id
      name
      email
      phone
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_CONTACT = gql`
  mutation DeleteContact($id: String!) {
    deleteContact(id: $id) {
      id
    }
  }
`;
