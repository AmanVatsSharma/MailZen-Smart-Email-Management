declare module 'jest-axe' {
  import type { CustomMatcher } from '@types/jest';

  export interface AxeResults {
    violations: Array<{
      id: string;
      impact?: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{
        target: string[];
        html: string;
        failureSummary?: string;
        any?: Array<unknown>;
        all?: Array<unknown>;
        none?: Array<unknown>;
      }>;
    }>;
    passes: Array<unknown>;
    incomplete: Array<unknown>;
    inapplicable: Array<unknown>;
  }

  export function axe(
    container: Element | Document,
    options?: Record<string, unknown>
  ): Promise<AxeResults>;

  export const toHaveNoViolations: CustomMatcher;
}