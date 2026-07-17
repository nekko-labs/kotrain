/**
 * Model auto-mode, a pure heuristic that picks the best available model for a
 * given prompt, with no extra model calls. "Best" means: match a strong model
 * to complex/coding work and a cheap/fast model to quick questions, among the
 * models the chat's provider actually exposes. Used by the ChatPane when the
 * user selects the ✨ Auto model option.
 */

import type { ModelInfo } from './models.js';

/** Sentinel model id meaning "let Kotrain pick per turn". */
export const AUTO_MODEL_ID = '__auto__';

const COMPLEX_RE =
  /\b(implement|refactor|debug|architecture|design|migrat|optim[iy]|algorithm|concurren|distributed|security|performance|test|build|fix the|root cause|trace|why does|explain how)\b/i;

/** Heuristic: does this prompt warrant a stronger (pricier) model? */
export function isComplexPrompt(prompt: string): boolean {
  if (prompt.length > 600) return true;
  // Multi-step asks (numbered lists, several sentences) lean complex.
  if (/```/.test(prompt)) return true;
  return COMPLEX_RE.test(prompt);
}

/**
 * Capability tier for a model, inferred from its id/name (higher = stronger).
 * Deliberately coarse, it only needs to rank what a provider offers.
 */
export function modelTier(model: ModelInfo): number {
  const id = `${model.id} ${model.name}`.toLowerCase();
  if (/opus|gpt-5|o1-pro|405b|70b|72b/.test(id)) return 5;
  if (/sonnet|gpt-4o(?!-mini)|gpt-4\.1(?!-mini)|o3(?!-mini)|o1(?!-mini)|llama-3\.[13]|qwen2?\.?5?-?(32|34)b|mixtral/.test(id)) return 4;
  if (/haiku|mini|flash|small|1\.5b|3b|7b|8b|9b|phi|gemma/.test(id)) return 2;
  return 3;
}

/**
 * Pick a concrete model id for a prompt from the available list. Complex prompts
 * get the highest-tier model; quick ones get the lowest-tier capable model
 * (tier ≥ 2). Ties break toward `preferred` (e.g. favorited) ids, then the list
 * order. Returns null only when there are no models.
 */
export function recommendModel(
  models: ModelInfo[],
  prompt: string,
  preferred: Set<string> = new Set(),
): string | null {
  if (models.length === 0) return null;
  if (models.length === 1) return models[0].id;

  const complex = isComplexPrompt(prompt);
  const ranked = models
    .map((m, i) => ({ m, tier: modelTier(m), i, fav: preferred.has(m.id) ? 0 : 1 }))
    .sort((a, b) => {
      // Complex → strongest first; simple → weakest-capable first.
      const byTier = complex ? b.tier - a.tier : a.tier - b.tier;
      return byTier || a.fav - b.fav || a.i - b.i;
    });

  // For simple prompts, never drop below tier 2 if a stronger option exists.
  if (!complex) {
    const capable = ranked.filter((r) => r.tier >= 2);
    if (capable.length) return capable[0].m.id;
  }
  return ranked[0].m.id;
}
