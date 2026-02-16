export type SmartReplyProviderRequest = {
  conversation: string;
  tone: string;
  length: string;
  count: number;
  includeSignature: boolean;
  customInstructions?: string | null;
};

export interface SmartReplySuggestionProvider {
  readonly providerId: string;
  generateSuggestions(
    input: SmartReplyProviderRequest,
  ): Promise<string[]> | string[];
}
