/** Context assembly + provenance (powers the Context Inspector panel). */

export type ContextSource =
  | 'attached-file'
  | 'guideline'
  | 'memory'
  | 'connector'
  | 'index-snippet'
  | 'system'
  | 'conversation'
  | 'skill';

export interface ContextItem {
  id: string;
  source: ContextSource;
  /** Display label, e.g. a file path or "AGENTS.md" or memory title. */
  label: string;
  /** Where it came from (absolute path, connector id, etc.). */
  origin: string;
  /** Estimated tokens this item contributes. */
  tokens: number;
  /** Whether the user has pinned this item to always include it. */
  pinned: boolean;
  /** Whether currently included in the prompt. */
  included: boolean;
  /** Short preview of the content. */
  preview: string;
}

export interface ContextBundle {
  items: ContextItem[];
  totalTokens: number;
  /** Model context window for the headroom bar. */
  contextWindow?: number;
}

/** Rough token estimate: ~4 chars per token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
