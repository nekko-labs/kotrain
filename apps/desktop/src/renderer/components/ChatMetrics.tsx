import React from 'react';
import type { ContextBundle, ContextItem, EffortLevel } from '@kotrain/shared';
import { formatUSD } from '@kotrain/shared';
import { useStore } from '../store.js';

/** Label + bar color per context source (mirrors the Context Inspector). */
const SOURCE_META: Record<string, { label: string; color: string }> = {
  system: { label: 'System prompt', color: '#8a8f98' },
  conversation: { label: 'Conversation', color: '#6d5efc' },
  guideline: { label: 'Guidelines', color: '#c08adb' },
  memory: { label: 'Memory', color: '#e0a44a' },
  'attached-file': { label: 'Files', color: '#5b9dd9' },
  connector: { label: 'Connectors', color: '#4ec98a' },
  'index-snippet': { label: 'Code index', color: '#5bc8c0' },
  skill: { label: 'Skill', color: '#e0574a' },
};
const FREE_COLOR = 'var(--surface-2)';

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

const EFFORTS: EffortLevel[] = ['low', 'normal', 'high'];

/**
 * Thin status bar under the conversation: context usage (with a hover breakdown
 * of where the tokens go), throughput, and cost on the left; the thinking toggle
 * (for reasoning models) and effort control clustered together on the right — the
 * at-a-glance metrics Kotrain mirrors from Claude Code. VRAM lives in the Context
 * panel (pinned at its foot) rather than here.
 */
export function ChatMetrics({
  bundle,
  tps,
  thinking,
  streaming,
  cost,
  controls,
  skill,
  thinkingSupported = false,
  thinkingPref,
  onSetThinking,
}: {
  bundle: ContextBundle | null;
  tps: number;
  thinking: boolean;
  streaming: boolean;
  cost?: number;
  controls?: React.ReactNode;
  /** The skill armed in the composer, folded into the token count when present. */
  skill?: { name: string; tokens: number } | null;
  /** Whether the selected model is reasoning-capable (enables the toggle). */
  thinkingSupported?: boolean;
  /** Per-chat thinking preference (undefined = model default, treated as on). */
  thinkingPref?: boolean;
  /** Set the per-chat thinking preference (true/false). */
  onSetThinking?: (value: boolean) => void;
}) {
  const settings = useStore((s) => s.settings);
  const effort = settings?.effort ?? 'normal';

  const included = (bundle?.items ?? []).filter((i: ContextItem) => i.included);
  const used = included.reduce((s, i) => s + i.tokens, 0) + (skill?.tokens ?? 0);
  const windowTokens = bundle?.contextWindow ?? 0;
  const pct = windowTokens ? Math.min(100, (used / windowTokens) * 100) : 0;

  const bySource = included.reduce<Record<string, number>>((acc, i) => {
    acc[i.source] = (acc[i.source] ?? 0) + i.tokens;
    return acc;
  }, {});
  if (skill?.tokens) bySource.skill = (bySource.skill ?? 0) + skill.tokens;

  // Rows for the breakdown, biggest first, each with its share of the window.
  const rows = Object.entries(bySource)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([src, n]) => ({
      src,
      n,
      meta: SOURCE_META[src] ?? { label: src, color: '#8a8f98' },
      pctWin: windowTokens ? (n / windowTokens) * 100 : 0,
    }));
  const free = windowTokens ? Math.max(0, windowTokens - used) : 0;
  const freePct = windowTokens ? (free / windowTokens) * 100 : 0;

  const cycleEffort = () => {
    const next = EFFORTS[(EFFORTS.indexOf(effort) + 1) % EFFORTS.length];
    window.nekko.updateSettings({ effort: next });
    useStore.getState().refreshSettings();
  };

  // Thinking is "on" unless the chat explicitly turned it off (undefined =
  // model default, which for reasoning models means thinking).
  const thinkingOn = thinkingPref !== false;

  return (
    <div className="border-t border-line px-4 py-1.5 md:px-5">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 text-[11px] text-ink-faint">
        {/* Context usage with an expanded hover breakdown */}
        <div className="group relative flex cursor-default items-center gap-1.5">
          <span className="font-medium text-ink-soft">Context</span>
          <span>
            {fmt(used)}{windowTokens ? ` / ${fmt(windowTokens)}` : ''}
          </span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, background: pct > 85 ? '#e0574a' : 'var(--accent)' }}
            />
          </span>
          {/* Expanded tooltip: segmented bar + per-source rows with %, plus free space. */}
          <div className="pointer-events-none absolute bottom-6 left-0 z-40 hidden w-72 rounded-xl border border-line p-3 text-[11px] shadow-lg group-hover:block" style={{ background: 'var(--surface)' }}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-semibold text-ink">Context window</span>
              <span className="text-ink-faint">
                {windowTokens ? `${used.toLocaleString()} / ${windowTokens.toLocaleString()}` : used.toLocaleString()}
                {windowTokens ? <span className="ml-1 text-ink-soft">({Math.round(pct)}%)</span> : null}
              </span>
            </div>
            {/* Segmented usage bar */}
            {windowTokens > 0 && (
              <div className="mb-2.5 flex h-2 w-full overflow-hidden rounded-full" style={{ background: FREE_COLOR }}>
                {rows.map((r) => (
                  <span key={r.src} title={`${r.meta.label}: ${r.n.toLocaleString()} tok`} style={{ width: `${r.pctWin}%`, background: r.meta.color }} />
                ))}
              </div>
            )}
            {included.length === 0 && !skill?.tokens && <div className="text-ink-faint">Nothing in context yet.</div>}
            {rows.map((r) => (
              <div key={r.src} className="flex items-center gap-2 py-0.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.meta.color }} />
                <span className="min-w-0 flex-1 truncate text-ink-soft">{r.meta.label}</span>
                <span className="shrink-0 tabular-nums text-ink-faint">{r.n.toLocaleString()} tok</span>
                {windowTokens > 0 && <span className="w-9 shrink-0 text-right tabular-nums text-ink-faint">{r.pctWin < 0.1 ? '<0.1' : r.pctWin.toFixed(1)}%</span>}
              </div>
            ))}
            {windowTokens > 0 && (
              <div className="flex items-center gap-2 py-0.5">
                <span className="h-2 w-2 shrink-0 rounded-full border border-line" style={{ background: FREE_COLOR }} />
                <span className="min-w-0 flex-1 truncate text-ink-soft">Free space</span>
                <span className="shrink-0 tabular-nums text-ink-faint">{free.toLocaleString()} tok</span>
                <span className="w-9 shrink-0 text-right tabular-nums text-ink-faint">{freePct.toFixed(1)}%</span>
              </div>
            )}
            <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-medium text-ink">
              <span>Total in use</span>
              <span className="tabular-nums">{used.toLocaleString()} tok</span>
            </div>
          </div>
        </div>

        {/* Throughput (only once a turn has produced tokens) */}
        {tps > 0 && (
          <>
            <span className="opacity-40">·</span>
            <span title="Output tokens per second (last turn)">{tps} tok/s</span>
          </>
        )}

        {cost != null && cost > 0 && (
          <>
            <span className="opacity-40">·</span>
            <span title="Estimated cost of this chat (list prices; local models are free)">{formatUSD(cost)}</span>
          </>
        )}

        {/* Right cluster: model controls, then the thinking + effort boxes side by side. */}
        <div className="ml-auto flex min-w-0 items-center gap-2.5">
          {controls && <div className="flex min-w-0 items-center gap-1">{controls}</div>}

          {/* Thinking: a live toggle for reasoning-capable models, else a passive indicator. */}
          {thinkingSupported && onSetThinking ? (
            <button
              className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 hover:text-ink"
              style={{ background: 'var(--surface-2)' }}
              onClick={() => onSetThinking(!thinkingOn)}
              title={thinkingOn ? 'Reasoning is on for this chat — click to turn off' : 'Reasoning is off for this chat — click to turn on'}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${thinkingOn && streaming ? 'animate-pulse' : ''}`}
                style={{ background: thinkingOn ? 'var(--accent)' : 'var(--ink-faint)' }}
              />
              💭 thinking {thinkingOn ? 'on' : 'off'}
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1" title="Whether the model streamed reasoning this turn">
              <span
                className={`h-1.5 w-1.5 rounded-full ${thinking && streaming ? 'animate-pulse' : ''}`}
                style={{ background: thinking ? 'var(--accent)' : 'var(--ink-faint)' }}
              />
              thinking {thinking ? 'on' : 'off'}
            </span>
          )}

          {/* Effort control */}
          <button
            className="shrink-0 rounded-md px-2 py-0.5 hover:text-ink"
            style={{ background: 'var(--surface-2)' }}
            onClick={cycleEffort}
            title="Sampling effort (temperature). Click to change."
          >
            effort: <span className="font-medium text-ink-soft">{effort}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
