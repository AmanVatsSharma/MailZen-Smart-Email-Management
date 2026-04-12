export type SmartReplyProviderRequest = {
  conversation: string;
  tone: string;
  length: string;
  count: number;
  includeSignature: boolean;
  customInstructions?: string | null;
  /** 0–100: how closely to match the user's personal voice. Higher = more personalized. */
  personalization?: number | null;
  /** 0–100: maps to LLM temperature (0 = precise/formal, 100 = highly creative). */
  creativityLevel?: number | null;
  /** Optional model name to override the env-configured default for this request. */
  modelOverride?: string | null;
};

export interface SmartReplySuggestionProvider {
  readonly providerId: string;
  generateSuggestions(
    input: SmartReplyProviderRequest,
  ): Promise<string[]> | string[];
}
