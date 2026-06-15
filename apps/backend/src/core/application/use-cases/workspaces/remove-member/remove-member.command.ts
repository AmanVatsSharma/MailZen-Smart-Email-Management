/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/remove-member/remove-member.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for RemoveMember use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RemoveMemberDto } from './remove-member.dto';

export class RemoveMemberCommand {
  constructor(public readonly input: RemoveMemberDto) {}
}
