/**
 * File:        apps/frontend/lib/apollo/queries/privacy.ts
 * Module:      Privacy · Apollo GraphQL Operations
 * Purpose:     GQL documents for GDPR/privacy account data export.
 *
 * Exports:
 *   - MY_ACCOUNT_DATA_EXPORT — lazy query returning generatedAtIso + dataJson for download
 *
 * Depends on:
 *   - @apollo/client — gql tag
 *
 * Side-effects:
 *   - none (document constants only)
 *
 * Key invariants:
 *   - dataJson is a JSON string — parse before inspecting, stringify before downloading
 *   - Query is intentionally lazy (useLazyQuery) — only fires when user clicks "Export"
 *
 * Read order:
 *   1. MY_ACCOUNT_DATA_EXPORT — only export
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { gql } from '@apollo/client';

export const MY_ACCOUNT_DATA_EXPORT = gql`
  query MyAccountDataExport {
    myAccountDataExport {
      generatedAtIso
      dataJson
    }
  }
`;
