/**
 * File:        apps/backend/src/core/application/use-cases/ai/get-sender-profile/get-sender-profile.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for GetSenderProfileHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { GetSenderProfileHandler } from './get-sender-profile.handler';
import { InMemorySenderProfileRepository } from '../../../../testing/in-memory-sender-profile.repository';
import { SenderProfile } from '../../../../domain/bounded-contexts/ai/sender-intelligence.aggregate';

describe('GetSenderProfileHandler', () => {
  let handler: GetSenderProfileHandler;
  let repo: InMemorySenderProfileRepository;

  beforeEach(async () => {
    repo = new InMemorySenderProfileRepository();
    handler = new GetSenderProfileHandler(repo);
    await repo.save(SenderProfile.create({
      id: 'sp-1',
      emailAddress: 'a@b.com',
      workspaceId: 'ws-1',
    }));
  });

  it('returns the matching sender profile', async () => {
    const result = await handler.execute({ senderEmail: 'a@b.com', userId: 'u-1' });
    expect(result.isOk()).toBe(true);
  });

  it('returns NotFound for unknown sender', async () => {
    const result = await handler.execute({ senderEmail: 'unknown@x.com', userId: 'u-1' });
    expect(result.isErr()).toBe(true);
  });
});
