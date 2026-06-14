/**
 * File:        apps/backend/src/core/application/use-cases/notifications/mark-read/mark-read.dto.ts
 * Module:      Notifications Use Cases
 * Purpose:     Data transfer object for MarkNotificationRead use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface MarkNotificationReadDto {
  id: string;
  userId: string;
}
