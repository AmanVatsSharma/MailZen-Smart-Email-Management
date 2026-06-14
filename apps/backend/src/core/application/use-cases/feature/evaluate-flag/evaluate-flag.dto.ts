/**
 * File:        apps/backend/src/core/application/use-cases/feature/evaluate-flag/evaluate-flag.dto.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Data transfer object for EvaluateFlag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface EvaluateFlagDto {
  key: string;
  workspaceId: string;
  bucket?: number;
}
