import { gql } from '@apollo/client';

// GraphQL Mutations
export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(loginInput: { email: $email, password: $password }) {
      token
      user {
        id
        email
        name
      }
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!, $name: String) {
    register(registerInput: { email: $email, password: $password, name: $name }) {
      token
      user {
        id
        email
        name
      }
    }
  }
`;

export const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(input: { email: $email })
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(input: { token: $token, newPassword: $newPassword })
  }
`;

export const setUserData = (user: any): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const getUserData = (): any | null => {
  if (typeof window !== 'undefined') {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }
  return null;
};

export const removeUserData = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
  }
};

export const logoutUser = (): void => {
  // Cookie-based session (HttpOnly) is cleared by calling backend logout.
  // This helper only clears locally cached user data.
  removeUserData();
};

// Handle token expiration and refresh (to be implemented) 