/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/mark-read/mark-read.command.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     Command for MarkThreadRead use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { MarkThreadReadDto } from './mark-read.dto';

export class MarkThreadReadCommand {
  constructor(public readonly input: MarkThreadReadDto) {}
}
