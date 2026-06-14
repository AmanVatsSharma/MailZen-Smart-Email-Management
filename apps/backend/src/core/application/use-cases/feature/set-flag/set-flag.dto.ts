/**
 * File:        apps/backend/src/core/application/use-cases/feature/set-flag/set-flag.dto.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Data transfer object for SetFlag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface SetFlagDto {
  key: string;
  workspaceId?: string | null;
  enabled: boolean;
  rolloutPercent?: number;
}
