import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($loginInput: LoginInput!) {
    login(loginInput: $loginInput) {
      token
      refreshToken
      requiresAliasSetup
      nextStep
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
      refreshToken
      requiresAliasSetup
      nextStep
      user {
        id
        email
        name
      }
    }
  }
`;

export const SIGNUP_VERIFY_MUTATION = gql`
  mutation SignupVerify($input: VerifySignupInput!) {
    signupVerify(input: $input) {
      token
      refreshToken
      requiresAliasSetup
      nextStep
      user {
        id
        email
        name
        phoneNumber
        isPhoneVerified
      }
    }
  }
`;

export const SIGNUP_SEND_OTP_MUTATION = gql`
  mutation SignupSendOtp($phoneNumber: String!) {
    signupSendOtp(input: { phoneNumber: $phoneNumber })
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

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

export const AUTH_ME_QUERY = gql`
  query AuthMe {
    authMe {
      user {
        id
        email
        name
      }
      requiresAliasSetup
      hasMailzenAlias
      nextStep
    }
  }
`;

export const MY_MAILBOXES_QUERY = gql`
  query MyMailboxes {
    myMailboxes
  }
`;

export const CREATE_MY_MAILBOX_MUTATION = gql`
  mutation CreateMyMailbox($desiredLocalPart: String!) {
    createMyMailbox(desiredLocalPart: $desiredLocalPart)
  }
`;
