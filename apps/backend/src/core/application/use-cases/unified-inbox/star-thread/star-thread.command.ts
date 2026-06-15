/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/star-thread/star-thread.command.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     Command for StarThread use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { StarThreadDto } from './star-thread.dto';

export class StarThreadCommand {
  constructor(public readonly input: StarThreadDto) {}
}
