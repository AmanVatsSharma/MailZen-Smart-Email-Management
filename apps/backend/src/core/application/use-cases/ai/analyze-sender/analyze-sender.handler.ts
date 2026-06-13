/**
 * File:        apps/backend/src/core/application/use-cases/ai/analyze-sender/analyze-sender.handler.ts
 * Module:      AI · Use Case
 * Purpose:     Analyze a sender's behavior using the AI gateway. Persists
 *              a SenderProfile aggregate with the new metrics.
 *              Re-shape of `sender-intelligence.service.analyzeSender`.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Result, makeResult } from '../../../../domain/shared/result';
import { SenderProfile } from '../../../../domain/bounded-contexts/ai/sender-intelligence.aggregate';
import { SENDER_PROFILE_REPOSITORY, ISenderProfileRepository } from '../../../ports/repositories/sender-profile.repository';
import { AI_GATEWAY, IAiGateway, SenderAnalysisDto } from '../../../ports/gateways/ai.gateway';

export interface AnalyzeSenderInput {
  senderEmail: string;
  workspaceId: string;
  userId: string;
  history: {
    totalReceived: number;
    totalReplied: number;
    averageReplyTimeMs: number;
    openRate: number;
    clickRate: number;
  };
}

@Injectable()
export class AnalyzeSenderHandler {
  constructor(
    @Inject(SENDER_PROFILE_REPOSITORY)
    private readonly profileRepo: ISenderProfileRepository,
    @Inject(AI_GATEWAY)
    private readonly aiGateway: IAiGateway,
  ) {}

  async execute(
    input: AnalyzeSenderInput,
  ): Promise<Result<SenderProfile, never>> {
    const existing = await this.profileRepo.findByEmailAddress(input.senderEmail);
    const baseMetrics: SenderAnalysisDto = {
      emailAddress: input.senderEmail,
      totalReceived: input.history.totalReceived,
      totalReplied: input.history.totalReplied,
      averageReplyTimeMs: input.history.averageReplyTimeMs,
      openRate: input.history.openRate,
      clickRate: input.history.clickRate,
      trustScore: existing?.trustScore ?? 0.5,
    };

    const analysis = await this.aiGateway.analyzeSender(input.senderEmail, baseMetrics);

    const profile = existing ?? SenderProfile.create({
      id: randomUUID(),
      emailAddress: input.senderEmail,
      workspaceId: input.workspaceId,
    });

    profile.applyMetrics({
      totalReceived: analysis.totalReceived,
      totalReplied: analysis.totalReplied,
      averageReplyTimeMs: analysis.averageReplyTimeMs,
      openRate: analysis.openRate,
      clickRate: analysis.clickRate,
      lastInteractionAt: new Date(),
      trustScore: analysis.trustScore,
    });

    await this.profileRepo.save(profile);
    return makeResult(Result.ok(profile));
  }
}
