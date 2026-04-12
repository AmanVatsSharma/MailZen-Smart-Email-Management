import { gql } from '@apollo/client';

export const SEND_PHONE_OTP = gql`
  mutation SendPhoneOtp($phoneNumber: String!) {
    sendPhoneOtp(phoneNumber: $phoneNumber)
  }
`;

export const VERIFY_PHONE_OTP = gql`
  mutation VerifyPhoneOtp($code: String!) {
    verifyPhoneOtp(code: $code)
  }
`;
