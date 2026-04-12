import { gql } from '@apollo/client';

export const GET_ALL_FEATURES = gql`
  query GetAllFeatures {
    getAllFeatures {
      id
      name
      targetType
      targetValue
      rolloutPercentage
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_FEATURE = gql`
  mutation CreateFeature($createFeatureInput: CreateFeatureInput!) {
    createFeature(createFeatureInput: $createFeatureInput) {
      id
      name
      targetType
      targetValue
      rolloutPercentage
      isActive
    }
  }
`;

export const UPDATE_FEATURE = gql`
  mutation UpdateFeature($updateFeatureInput: UpdateFeatureInput!) {
    updateFeature(updateFeatureInput: $updateFeatureInput) {
      id
      name
      targetType
      targetValue
      rolloutPercentage
      isActive
    }
  }
`;

export const DELETE_FEATURE = gql`
  mutation DeleteFeature($id: String!) {
    deleteFeature(id: $id) {
      id
    }
  }
`;
