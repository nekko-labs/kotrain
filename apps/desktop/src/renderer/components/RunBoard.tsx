import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ExperimentNode, MazeNode, ModelInfo, TrainingRun } from '@kotrain/shared';
import { formatRuntime, layoutMaze, runStats } from '@kotrain/shared';
import { useStore } from '../store.js';

/**
 * Shared building blocks for the Training and Goals dashboards: the stats
 * header tiles, the experiment "idea maze" (every idea the agent tried, growing
 * over time), the guidance composer, the activity log, and the run model
 * picker used by both new-run forms. Mostly pure presentation; all dashboard
 * data flows in as a TrainingRun.
 */

const STATUS_COLOR: Record<TrainingRun['status'], string> = {
  draft: 'var(--ink-faint, #8a8a97)',
  running: '#60a5fa',
  paused: '#f59e0b',
  completed: '#4ade80',
  stopped: '#8a8a97',
  failed: '#f87171',
};

export function RunStatusChip({ run }: { run: TrainingRun }) {
  const color = STATUS_COLOR[run.status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${run.status === 'running' ? 'animate-pulse' : ''}`} style={{ background: color }} />
      {run.status}
    </span>
  );
}

function fmtScore(v?: number): string {
  if (v == null) return '—';
  return Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** The dashboard's stat tiles (best score, experiments, success rate, …). */
export function RunStatTiles({ run }: { run: TrainingRun }) {
  const s = runStats(run);
  const best = run.experiments.find((e) => e.id === run.bestExperimentId);
  const tiles: Array<{ label: string; value: string; color?: string; sub?: string }> = [
    { label: `Best ${s.bestMetric ?? 'score'}`, value: fmtScore(s.best), color: '#22d3ee', sub: best?.title.slice(0, 26) },
    { label: 'Experiments', value: String(s.experiments) },
    { label: 'Success rate', value: s.successRate != null ? `${Math.round(s.successRate * 100)}%` : '—' },
    { label: 'Emergent niches', value: String(s.niches) },
    { label: 'Self-repairs', value: String(s.repairs) },
    { label: 'Runtime', value: formatRuntime(s.runtimeMs) },
    { label: 'Turns', value: String(s.turns) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map((t) => (
        <div key={t.label} className="card px-3 py-2.5">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">{t.label}</div>
          <div className="mt-0.5 text-lg font-bold tabular-nums" style={t.color ? { color: t.color } : undefined}>{t.value}</div>
          {t.sub && <div className="truncate text-[10px] text-[var(--ink-faint)]">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** The champion card: the current leader + the agent's note about it. */
export function ChampionCard({ run }: { run: TrainingRun }) {
  const best = run.experiments.find((e) => e.id === run.bestExperimentId);
  if (!best) return null;
  return (
    <div className="card border border-emerald-500/25 px-3.5 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-400">
        Current champion{best.approach ? ` · ${best.approach}` : ''}
      </div>
      <div className="mt-1 font-mono text-[12.5px] font-semibold text-emerald-300">{best.title}</div>
      {best.note && <div className="mt-1 text-[11.5px] leading-snug text-[var(--ink-soft)]">{best.note}</div>}
    </div>
  );
}

function nodeColor(exp: ExperimentNode, run: TrainingRun, parentScore?: number): { fill: string; ring?: string } {
  if (exp.id === run.bestExperimentId) return { fill: '#fbbf24', ring: 'rgba(251,191,36,0.35)' };
  if (exp.status === 'running') return { fill: '#60a5fa', ring: 'rgba(96,165,250,0.35)' };
  if (exp.status === 'failed') return { fill: 'rgba(248,113,113,0.55)' };
  const improved =
    exp.score != null && parentScore != null && (run.config?.minimizeMetric ? exp.score < parentScore : exp.score > parentScore);
  if (improved || (exp.score != null && parentScore == null && exp.status !== 'planned')) return { fill: '#4ade80' };
  return { fill: 'color-mix(in srgb, var(--ink-faint) 65%, transparent)' };
}

/**
 * The idea maze: every experiment the agent tried, laid out chronologically
 * left→right with branches hanging beneath their parents; the path to the
 * current leader is highlighted. Click a node for details.
 */
export function IdeaMaze({ run }: { run: TrainingRun }) {
  const [selected, setSelected] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => layoutMaze(run), [run]);
  const byId = useMemo(() => new Map(run.experiments.map((e) => [e.id, e])), [run.experiments]);
  const pos = useMemo(() => new Map(nodes.map((n) => [n.exp.id, n])), [nodes]);

  const COL_W = 34;
  const ROW_H = 46;
  const LABEL_H = 128;
  const X0 = 26;
  const maxRow = nodes.reduce((m, n) => Math.max(m, n.row), 0);
  const width = X0 * 2 + Math.max(1, nodes.length) * COL_W;
  const height = LABEL_H + (maxRow + 1) * ROW_H + 26;
  const x = (n: MazeNode) => X0 + n.col * COL_W;
  const y = (n: MazeNode) => LABEL_H + n.row * ROW_H;

  const sel = selected ? byId.get(selected) : null;
  const lastLog = [...run.log].reverse().find((l) => l.kind !== 'hint');

  if (nodes.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center text-[12.5px] text-[var(--ink-faint)]">
        No experiments yet — they appear here live as the agent tries ideas.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line)] px-3.5 py-2">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          The idea maze — every idea the agent tried, growing over time
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono text-[9.5px] text-[var(--ink-faint)]">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: 'color-mix(in srgb, var(--ink-faint) 65%, transparent)' }} />tried</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-green-400 align-middle" />got better</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />best so far</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400 align-middle" />running</span>
          <span><i className="mr-1 inline-block h-0.5 w-4 bg-amber-400/70 align-middle" />path to the leader</span>
        </span>
      </div>
      {lastLog && (
        <div className="border-b border-[var(--line)] px-3.5 py-1.5 font-mono text-[11px] text-[var(--ink-soft)]">
          {lastLog.text}
        </div>
      )}
      <div ref={scrollRef} className="overflow-x-auto">
        <svg width={width} height={height} className="block">
          {/* connectors */}
          {nodes.map((n) => {
            if (!n.exp.parentId) return null;
            const p = pos.get(n.exp.parentId);
            if (!p) return null;
            const onPath = n.onBestPath && p.onBestPath;
            return (
              <path
                key={`e-${n.exp.id}`}
                d={`M ${x(p)} ${y(p)} C ${x(p)} ${y(p) + 20}, ${x(n)} ${y(n) - 20}, ${x(n)} ${y(n)}`}
                stroke={onPath ? 'rgba(251,191,36,0.7)' : 'color-mix(in srgb, var(--ink-faint) 35%, transparent)'}
                strokeWidth={onPath ? 2 : 1.2}
                fill="none"
              />
            );
          })}
          {/* spine between consecutive roots (chronology) */}
          {nodes
            .filter((n) => n.row === 0)
            .map((n, i, roots) => {
              if (i === 0) return null;
              const prev = roots[i - 1];
              const onPath = n.onBestPath && prev.onBestPath;
              return (
                <line
                  key={`s-${n.exp.id}`}
                  x1={x(prev)} y1={y(prev)} x2={x(n)} y2={y(n)}
                  stroke={onPath ? 'rgba(251,191,36,0.7)' : 'color-mix(in srgb, var(--ink-faint) 25%, transparent)'}
                  strokeWidth={onPath ? 2 : 1}
                />
              );
            })}
          {/* vertical title labels + nodes */}
          {nodes.map((n) => {
            const parent = n.exp.parentId ? byId.get(n.exp.parentId) : undefined;
            const { fill, ring } = nodeColor(n.exp, run, parent?.score);
            const isSel = selected === n.exp.id;
            return (
              <g key={n.exp.id} className="cursor-pointer" onClick={() => setSelected(isSel ? null : n.exp.id)}>
                {n.row === 0 && (
                  <text
                    x={x(n)} y={y(n) - 14}
                    transform={`rotate(-90 ${x(n)} ${y(n) - 14})`}
                    className="select-none"
                    fontFamily="var(--font-mono, monospace)"
                    fontSize="9"
                    fill={n.exp.id === run.bestExperimentId ? '#fbbf24' : 'var(--ink-faint)'}
                  >
                    {n.exp.title.slice(0, 26)}
                  </text>
                )}
                {ring && <circle cx={x(n)} cy={y(n)} r={11} fill={ring} className={n.exp.status === 'running' ? 'animate-pulse' : ''} />}
                <circle cx={x(n)} cy={y(n)} r={7} fill={fill} stroke={isSel ? 'var(--accent)' : 'rgba(0,0,0,0.25)'} strokeWidth={isSel ? 2 : 1} />
                {n.exp.score != null && (
                  <text x={x(n)} y={y(n) + 20} textAnchor="middle" fontFamily="var(--font-mono, monospace)" fontSize="8.5" fill="var(--ink-faint)">
                    {fmtScore(n.exp.score).slice(0, 6)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {sel && (
        <div className="border-t border-[var(--line)] px-3.5 py-2.5 text-[12px]">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <b className="font-mono">{sel.title}</b>
            <span className="font-mono text-[10.5px] uppercase text-[var(--ink-faint)]">{sel.status}</span>
            {sel.score != null && <span className="font-mono text-cyan-400">{fmtScore(sel.score)}{sel.metric ? ` ${sel.metric}` : ''}</span>}
            {sel.approach && <span className="text-[var(--ink-faint)]">family: {sel.approach}</span>}
            {sel.parentId && <span className="text-[var(--ink-faint)]">branched from {sel.parentId}</span>}
          </div>
          {sel.note && <div className="mt-1 text-[var(--ink-soft)]">{sel.note}</div>}
        </div>
      )}
    </div>
  );
}

/**
 * Guidance composer: fold a course-correction into the run's next turn. Not a
 * chat, one steer at a time, queued as a pending hint and consumed on the next
 * iteration. `title`/`helper`/`buttonLabel` let a surface frame it its own way
 * (Goals presents it full-width as "Steer the mission").
 */
export function HintComposer({
  run,
  placeholder,
  title = 'Guide the agent',
  helper = "Folded into the agent's next turn: new approaches to try, course corrections, or pointers to new data.",
  buttonLabel = 'Send',
}: {
  run: TrainingRun;
  placeholder: string;
  title?: string;
  helper?: string;
  buttonLabel?: string;
}) {
  const [text, setText] = useState('');
  const pending = run.hints.filter((h) => !h.consumedAt);
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await window.nekko.addTrainingHint(run.id, t);
  };
  return (
    <div className="card px-3.5 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">{title}</div>
      <div className="mt-2 flex gap-2">
        <textarea
          className="input min-h-[44px] flex-1 resize-y py-2 text-[12.5px]"
          rows={2}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn btn-primary self-end" onClick={() => void send()} disabled={!text.trim()}>
          {buttonLabel}
        </button>
      </div>
      {pending.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pending.map((h) => (
            <span key={h.id} className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-300" title="Will be folded into the agent's next turn">
              ⏳ {h.text.slice(0, 60)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5 text-[10.5px] text-[var(--ink-faint)]">{helper}</div>
    </div>
  );
}

/** Activity feed: milestones, failures, hints, and info as the run progresses. */
export function RunLog({ run, max = 60 }: { run: TrainingRun; max?: number }) {
  const KIND_COLOR = { info: 'var(--ink-faint)', milestone: '#4ade80', hint: '#f59e0b', error: '#f87171' } as const;
  const entries = [...run.log].slice(-max).reverse();
  if (!entries.length) return null;
  return (
    <div className="card max-h-64 overflow-y-auto px-3.5 py-2.5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Activity</div>
      <div className="mt-1.5 space-y-1">
        {entries.map((l, i) => (
          <div key={`${l.at}-${i}`} className="flex gap-2 text-[11.5px] leading-snug">
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--ink-faint)]">
              {new Date(l.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ color: KIND_COLOR[l.kind] }}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Optional agent-model override for a new run: which provider + model drive the
 * run's dedicated agent session. Left on "App default", the run uses the
 * global default model. Picking a provider loads its live model list (with a
 * free-text fallback when the provider can't list models). Both fields must be
 * chosen for the override to apply; the forms only send a complete pair.
 */
export function RunModelPicker({
  providerId, modelId, onChange,
}: {
  providerId: string;
  modelId: string;
  onChange: (next: { providerId: string; modelId: string }) => void;
}) {
  const { settings } = useStore();
  const providers = (settings?.providers ?? []).filter((p) => p.enabled);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!providerId) { setModels([]); return; }
    let alive = true;
    setLoading(true);
    window.nekko.listModels(providerId)
      .then((ms) => { if (alive) setModels(ms); })
      .catch(() => { if (alive) setModels([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [providerId]);

  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <select
        className="input w-full"
        value={providerId}
        onChange={(e) => onChange({ providerId: e.target.value, modelId: '' })}
      >
        <option value="">App default</option>
        {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {!providerId ? (
        <input className="input w-full" disabled placeholder="(uses the default model)" />
      ) : models.length > 0 ? (
        <select
          className="input w-full"
          value={modelId}
          onChange={(e) => onChange({ providerId, modelId: e.target.value })}
        >
          <option value="">Pick a model…</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
        </select>
      ) : (
        <input
          className="input w-full"
          placeholder={loading ? 'Loading models…' : 'model id, e.g. qwen3:14b'}
          value={modelId}
          onChange={(e) => onChange({ providerId, modelId: e.target.value })}
        />
      )}
    </div>
  );
}
