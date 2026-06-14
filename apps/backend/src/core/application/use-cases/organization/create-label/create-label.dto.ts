/**
 * File:        apps/backend/src/core/application/use-cases/organization/create-label/create-label.dto.ts
 * Module:      Organization Use Cases
 * Purpose:     Data transfer object for CreateLabel use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface CreateLabelDto {
  workspaceId: string;
  name: string;
  color?: string;
  parentId?: string | null;
}
