/**
 * File:        apps/frontend/lib/apollo/queries/attachments.ts
 * Module:      Email · Attachment GraphQL Operations
 * Purpose:     GQL documents for uploading, deleting, and listing email attachments.
 *
 * Exports:
 *   - UPLOAD_ATTACHMENT  — mutation: uploads a base64-encoded file attached to an email
 *   - DELETE_ATTACHMENT  — mutation: removes an attachment by emailId + attachmentId
 *   - GET_ATTACHMENTS    — query: lists all attachments for a given email
 *
 * Depends on:
 *   - @apollo/client — gql tag
 *
 * Side-effects:
 *   - none (document constants only)
 *
 * Key invariants:
 *   - attachment.content must be raw base64 (no data-URL prefix like "data:...;base64,")
 *   - emailId must reference an existing saved email — upload after sendEmail/createDraft
 *   - size is required and must match the actual decoded byte length
 *
 * Read order:
 *   1. UPLOAD_ATTACHMENT — primary mutation
 *   2. DELETE_ATTACHMENT — removal mutation
 *   3. GET_ATTACHMENTS   — read query
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { gql } from '@apollo/client';

export const UPLOAD_ATTACHMENT = gql`
  mutation UploadAttachment($input: CreateAttachmentInput!) {
    uploadAttachment(input: $input) {
      id
      filename
      contentType
      size
      url
      emailId
      createdAt
    }
  }
`;

export const DELETE_ATTACHMENT = gql`
  mutation DeleteAttachment($input: DeleteAttachmentInput!) {
    deleteAttachment(input: $input)
  }
`;

export const GET_ATTACHMENTS = gql`
  query GetAttachments($emailId: String!) {
    getAttachments(emailId: $emailId) {
      id
      filename
      contentType
      size
      url
      emailId
      createdAt
    }
  }
`;
