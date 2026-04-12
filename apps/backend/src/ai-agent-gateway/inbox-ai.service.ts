/**
 * File: apps/backend/src/ai-agent-gateway/inbox-ai.service.ts
 * Purpose: LLM-powered inbox action analysis replacing regex/heuristic *ForUser methods.
 *
 * Uses the same OpenAI env vars as the smart-reply module:
 *   SMART_REPLY_USE_OPENAI, SMART_REPLY_OPENAI_API_KEY, SMART_REPLY_OPENAI_BASE_URL,
 *   SMART_REPLY_OPENAI_MODEL, SMART_REPLY_OPENAI_TIMEOUT_MS
 *
 * Falls back to null (caller handles fallback to old heuristics) if AI is unavailable.
 */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

export interface InboxThreadMessage {
  from?: string | null;
  subject?: string | null;
  snippet?: string | null;
  /** Full plain-text body (preferred over snippet when available) */
  body?: string | null;
  /** Alternative field name used by ExternalEmailMessage entity */
  textBody?: string | null;
  internalDate?: Date | string | null;
}

export interface ClassifyResult {
  label: string;
  confidence: number;
  message: string;
}

export interface PrioritizeResult {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  message: string;
}

export interface ActionItemsResult {
  items: string[];
  message: string;
}

type OpenAiChatResponse = {
  choices?: Array<{
    message?: { content?: string | null } | null;
  } | null>;
};

@Injectable()
export class InboxAiService {
  private readonly logger = new Logger(InboxAiService.name);

  private isConfigured(): boolean {
    const enabled = (process.env.SMART_REPLY_USE_OPENAI || 'false').trim() === 'true';
    const key = String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim();
    return enabled && key.length > 0;
  }

  private buildThreadTranscript(messages: InboxThreadMessage[]): string {
    if (!messages.length) return '(no messages)';
    return messages
      .map((msg, idx) => {
        const from = String(msg.from || 'Unknown').trim();
        const subject = msg.subject ? `[${String(msg.subject).trim()}]` : '';
        // Prefer full body (body or textBody); fall back to snippet; cap per message
        const rawContent = String(msg.body || msg.textBody || msg.snippet || '').replace(/\s+/g, ' ').trim();
        const content = rawContent.slice(0, 2000) || '(no content)';
        const date = msg.internalDate
          ? new Date(msg.internalDate).toISOString().slice(0, 10)
          : '';
        return `Message ${idx + 1}${date ? ` (${date})` : ''} — From: ${from}${subject ? ' ' + subject : ''}: ${content}`;
      })
      .join('\n');
  }

  private async callOpenAi(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const apiKey = String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim();
    const baseUrl = process.env.SMART_REPLY_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.SMART_REPLY_OPENAI_MODEL || 'gpt-4o-mini';
    const timeoutMs = Number(process.env.SMART_REPLY_OPENAI_TIMEOUT_MS || 8000);

    try {
      const response = await axios.post<OpenAiChatResponse>(
        `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          timeout: Number.isFinite(timeoutMs) ? Math.max(timeoutMs, 2000) : 8000,
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
        },
      );
      const content = String(response.data?.choices?.[0]?.message?.content || '').trim();
      return content || null;
    } catch (error: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'inbox_ai_openai_call_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }

  private tryParseJson<T>(raw: string): T | null {
    const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const candidate = jsonMatch ? jsonMatch[0] : raw;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }

  async summarizeThread(messages: InboxThreadMessage[]): Promise<string | null> {
    if (!messages.length) return null;
    const transcript = this.buildThreadTranscript(messages);
    const systemPrompt =
      'You are an expert email assistant. Summarize email threads concisely and accurately. ' +
      'Format your response as 3-5 bullet points (using "• ") that capture the key points, decisions, and context. ' +
      'Be specific about who said what. Do not add commentary outside the bullets.';
    const userPrompt = `Summarize this email thread:\n\n${transcript}`;
    const raw = await this.callOpenAi(systemPrompt, userPrompt);
    if (!raw) return null;
    this.logger.debug(serializeStructuredLog({ event: 'inbox_ai_summarize_completed' }));
    return raw;
  }

  async classifyThread(messages: InboxThreadMessage[]): Promise<ClassifyResult | null> {
    if (!messages.length) return null;
    const transcript = this.buildThreadTranscript(messages);
    const systemPrompt =
      'You are an email classification expert. Classify the email thread into exactly one category and return ONLY a JSON object. ' +
      'Valid labels: urgent_issue, coordination, commercial, status_tracking, support, general. ' +
      'Output format: {"label": "<label>", "confidence": <0.0-1.0>, "reason": "<one sentence explanation>"} ' +
      'Return nothing else — no markdown, no explanation outside the JSON.';
    const userPrompt = `Classify this email thread:\n\n${transcript}`;
    const raw = await this.callOpenAi(systemPrompt, userPrompt);
    if (!raw) return null;
    const parsed = this.tryParseJson<{ label: string; confidence: number; reason: string }>(raw);
    if (!parsed || !parsed.label) return null;
    const validLabels = new Set(['urgent_issue', 'coordination', 'commercial', 'status_tracking', 'support', 'general']);
    const label = validLabels.has(parsed.label) ? parsed.label : 'general';
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7));
    const reason = String(parsed.reason || '').trim() || `Thread classified as ${label.toUpperCase()}.`;
    this.logger.debug(serializeStructuredLog({ event: 'inbox_ai_classify_completed', label, confidence }));
    return {
      label,
      confidence,
      message: `Thread classified as ${label.toUpperCase()} (confidence ${Math.round(confidence * 100)}%): ${reason}`,
    };
  }

  async prioritizeThread(messages: InboxThreadMessage[]): Promise<PrioritizeResult | null> {
    if (!messages.length) return null;
    const transcript = this.buildThreadTranscript(messages);
    const systemPrompt =
      'You are an email prioritization expert. Analyze the email thread and return ONLY a JSON object with your assessment. ' +
      'Valid levels: HIGH, MEDIUM, LOW. Score is 0-100 (100 = most urgent). ' +
      'Output format: {"level": "<HIGH|MEDIUM|LOW>", "score": <0-100>, "reason": "<one sentence explanation>"} ' +
      'Consider: urgency indicators, sender authority, deadlines, financial impact, question density. ' +
      'Return nothing else — no markdown, no explanation outside the JSON.';
    const userPrompt = `Assess the priority of this email thread:\n\n${transcript}`;
    const raw = await this.callOpenAi(systemPrompt, userPrompt);
    if (!raw) return null;
    const parsed = this.tryParseJson<{ level: string; score: number; reason: string }>(raw);
    if (!parsed || !parsed.level) return null;
    const validLevels = new Set(['HIGH', 'MEDIUM', 'LOW']);
    const level = (validLevels.has(String(parsed.level).toUpperCase())
      ? String(parsed.level).toUpperCase()
      : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW';
    const score = Math.max(0, Math.min(100, Math.trunc(Number(parsed.score) || 50)));
    const reason = String(parsed.reason || '').trim() || `Priority set to ${level}.`;
    this.logger.debug(serializeStructuredLog({ event: 'inbox_ai_prioritize_completed', level, score }));
    return {
      level,
      score,
      message: `Priority: ${level} (score ${score}/100) — ${reason}`,
    };
  }

  async extractActionItems(messages: InboxThreadMessage[]): Promise<ActionItemsResult | null> {
    if (!messages.length) return null;
    const transcript = this.buildThreadTranscript(messages);
    const systemPrompt =
      'You are an expert at extracting action items from email threads. ' +
      'Identify concrete tasks, commitments, and follow-ups from the thread. ' +
      'Return ONLY a JSON array of concise action item strings (max 5 items, max 150 chars each). ' +
      'Example: ["Reply to John with the updated proposal", "Schedule a call for next week"] ' +
      'If no clear action items exist, return an empty array []. No markdown, no explanation.';
    const userPrompt = `Extract action items from this email thread:\n\n${transcript}`;
    const raw = await this.callOpenAi(systemPrompt, userPrompt);
    if (!raw) return null;
    const parsed = this.tryParseJson<string[]>(raw);
    if (!Array.isArray(parsed)) return null;
    const items = parsed
      .map((item) => String(item || '').trim().slice(0, 150))
      .filter(Boolean)
      .slice(0, 5);
    this.logger.debug(serializeStructuredLog({ event: 'inbox_ai_extract_actions_completed', count: items.length }));
    if (!items.length) {
      return { items: [], message: 'No explicit action items were detected in this thread.' };
    }
    const bulletList = items.map((item, i) => `${i + 1}. ${item}`).join(' ');
    return {
      items,
      message: `Extracted ${items.length} action item(s): ${bulletList}`,
    };
  }

  async composeReplyDraft(messages: InboxThreadMessage[]): Promise<string | null> {
    if (!messages.length) return null;
    const transcript = this.buildThreadTranscript(messages);
    const latest = messages[0];
    const subject = String(latest?.subject || 'your email').trim();
    const systemPrompt =
      'You are a professional email writing assistant. Compose a concise, context-aware reply draft. ' +
      'The reply should: address the key points raised, maintain a professional yet warm tone, ' +
      'be specific to the thread context (not generic), and be ready to send with minor edits. ' +
      'Format as a proper email body (no subject line, no extra preamble).';
    const userPrompt = `Compose a reply draft for this email thread (subject: "${subject}"):\n\n${transcript}`;
    const raw = await this.callOpenAi(systemPrompt, userPrompt);
    if (!raw) return null;
    this.logger.debug(serializeStructuredLog({ event: 'inbox_ai_compose_draft_completed' }));
    return `Draft reply for "${subject}":\n\n${raw}`;
  }
}
