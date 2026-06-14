/**
 * File:        apps/backend/src/core/application/use-cases/notifications/mark-read/mark-read.command.ts
 * Module:      Notifications Use Cases
 * Purpose:     Command for MarkNotificationRead use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { MarkNotificationReadDto } from './mark-read.dto';

export class MarkNotificationReadCommand {
  constructor(public readonly input: MarkNotificationReadDto) {}
}
