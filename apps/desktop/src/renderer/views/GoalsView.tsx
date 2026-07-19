import React, { useEffect, useState } from 'react';
import type { NewTrainingRun, PlanStep, TrainingRun } from '@kotrain/shared';
import { formatRuntime, planProgress, runStats } from '@kotrain/shared';
import { useStore } from '../store.js';
import { HintComposer, RunLog, RunModelPicker, RunStatusChip } from '../components/RunBoard.js';

/**
 * The Goals tab: hand the agent a long-running goal and it works plan-first,
 * it maps the work into an execution plan, then executes step by step and
 * iterates (re-planning when reality disagrees) until the goal is finished.
 * Built to stay legible over hours or days: a big elapsed/status header, the
 * live plan checklist, and a prominent activity feed. Course-correct any time
 * via hints that fold into the agent's next turn. Model testing belongs in the
 * Training tab; this surface is about getting work finished.
 */
export function GoalsView() {
  const { settings, openChatPane, setView } = useStore();
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void window.nekko.listTrainingRuns().then(setRuns);
    return window.nekko.onTrainingUpdated(setRuns);
  }, []);

  const mine = runs.filter((r) => r.kind === 'goal');
  const selected = mine.find((r) => r.id === selectedId) ?? mine[0] ?? null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--line)]">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[13px] font-semibold">Goals</span>
          <button className="btn btn-primary !px-2.5 !py-1 text-[12px]" onClick={() => setCreating(true)}>+ New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {mine.length === 0 && (
            <div className="px-2 py-4 text-[12px] text-[var(--ink-faint)]">
              No goals yet. Give the agent something to finish: it plans the work, executes the plan, and iterates until it's done.
            </div>
          )}
          {mine.map((r) => {
            const p = planProgress(r.plan);
            return (
              <button
                key={r.id}
                className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] ${selected?.id === r.id && !creating ? 'bg-[var(--surface-2)]' : ''}`}
                onClick={() => { setSelectedId(r.id); setCreating(false); }}
              >
                <div className="truncate text-[12.5px] font-medium">{r.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <RunStatusChip run={r} />
                  <span className="font-mono text-[10px] text-[var(--ink-faint)]">
                    {p.total ? `${p.done + p.skipped}/${p.total}` : formatRuntime(runStats(r).runtimeMs)}
                  </span>
                </div>
                {p.total > 0 && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(p.ratio * 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)))' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {creating || !selected ? (
          <NewGoalForm
            workspaces={settings?.workspaces ?? []}
            onCreated={(run) => { setSelectedId(run.id); setCreating(false); }}
            onCancel={mine.length ? () => setCreating(false) : undefined}
          />
        ) : (
          <GoalDashboard run={selected} onOpenChat={(sid) => { openChatPane(sid); setView('chat'); }} />
        )}
      </div>
    </div>
  );
}

function GoalDashboard({ run, onOpenChat }: { run: TrainingRun; onOpenChat: (sessionId: string) => void }) {
  const s = runStats(run);
  const p = planProgress(run.plan);
  const remove = () => {
    if (confirm(`Delete goal "${run.name}"? The plan and history are lost.`)) void window.nekko.deleteTrainingRun(run.id);
  };
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {/* long-horizon header: goal, status, big clock */}
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight">{run.name}</h1>
            <RunStatusChip run={run} />
            <PhaseChip run={run} />
          </div>
          <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">{run.goal}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Working for</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: run.status === 'running' ? '#60a5fa' : 'inherit' }}>
            {formatRuntime(s.runtimeMs)}
          </div>
        </div>
        <span className="flex w-full gap-1.5 sm:w-auto">
          {run.status !== 'running' && run.status !== 'completed' && (
            <button className="btn btn-primary !py-1.5" onClick={() => void window.nekko.startTrainingRun(run.id)}>
              {run.turns ? 'Resume' : 'Start'}
            </button>
          )}
          {run.status === 'running' && (
            <button className="btn btn-outline !py-1.5" onClick={() => void window.nekko.pauseTrainingRun(run.id)}>Pause</button>
          )}
          {(run.status === 'running' || run.status === 'paused') && (
            <button className="btn btn-ghost !py-1.5 text-red-400" onClick={() => void window.nekko.stopTrainingRun(run.id)}>Stop</button>
          )}
          {run.sessionId && <button className="btn btn-outline !py-1.5" onClick={() => onOpenChat(run.sessionId!)}>Open chat →</button>}
          <button className="btn btn-ghost !py-1.5 text-red-400" onClick={remove}>Delete</button>
        </span>
      </div>

      <GoalStatTiles run={run} />

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <PlanPanel run={run} />
          <RunLog run={run} max={120} />
        </div>
        <div className="space-y-3">
          {p.current && (
            <div className="card border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] px-3.5 py-3">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--accent)]">Current step</div>
              <div className="mt-1 text-[12.5px] font-semibold">{p.current.title}</div>
              {p.current.note && <div className="mt-1 text-[11.5px] leading-snug text-[var(--ink-soft)]">{p.current.note}</div>}
            </div>
          )}
          <HintComposer
            run={run}
            placeholder='e.g. "skip the docs step for now", "the staging server moved to :4000", "prioritize the failing tests"'
          />
        </div>
      </div>
    </div>
  );
}

/** Where the run is in its plan → execute → iterate loop. */
function PhaseChip({ run }: { run: TrainingRun }) {
  if (run.status === 'draft' || (run.turns ?? 0) === 0) return null;
  const p = planProgress(run.plan);
  const label = !p.total ? 'planning' : run.status === 'completed' ? 'finished' : p.done + p.skipped >= p.total ? 'verifying' : 'executing';
  return (
    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">
      {label}
    </span>
  );
}

/** Goal-shaped stat tiles: plan progress, iterations, attempts, runtime. */
function GoalStatTiles({ run }: { run: TrainingRun }) {
  const s = runStats(run);
  const p = planProgress(run.plan);
  const tiles: Array<{ label: string; value: string; color?: string; sub?: string }> = [
    {
      label: 'Plan progress',
      value: p.total ? `${Math.round(p.ratio * 100)}%` : '…',
      color: 'var(--accent)',
      sub: p.total ? `${p.done} done${p.skipped ? `, ${p.skipped} skipped` : ''} of ${p.total}` : 'plan comes first',
    },
    { label: 'Iterations', value: String(s.turns), sub: 'agent turns' },
    { label: 'Attempts', value: String(s.experiments), sub: s.repairs ? `${s.repairs} self-repaired` : undefined },
    { label: 'Runtime', value: formatRuntime(s.runtimeMs) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

const STEP_GLYPH: Record<PlanStep['status'], { glyph: string; color: string }> = {
  pending: { glyph: '○', color: 'var(--ink-faint)' },
  active: { glyph: '◉', color: 'var(--accent)' },
  done: { glyph: '✓', color: '#4ade80' },
  skipped: { glyph: '⊘', color: 'var(--ink-faint)' },
};

/** The heart of the dashboard: the agent's live execution plan as a checklist. */
function PlanPanel({ run }: { run: TrainingRun }) {
  const steps = run.plan ?? [];
  const p = planProgress(run.plan);
  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">The plan</div>
        {p.total > 0 && (
          <span className="font-mono text-[10.5px] tabular-nums text-[var(--ink-soft)]">{p.done + p.skipped}/{p.total}</span>
        )}
      </div>
      {steps.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-[var(--ink-faint)]">
          {run.status === 'running'
            ? 'Planning… the first thing the agent does is map the work into concrete steps. They appear here as it writes them.'
            : 'Nothing yet. Start the goal and the agent begins by writing its execution plan, then works through it step by step.'}
        </p>
      ) : (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round(p.ratio * 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)))' }}
            />
          </div>
          <ol className="mt-2.5 space-y-1">
            {steps.map((step, i) => {
              const g = STEP_GLYPH[step.status];
              return (
                <li key={step.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5" style={step.status === 'active' ? { background: 'color-mix(in srgb, var(--accent) 7%, transparent)' } : undefined}>
                  <span className={`mt-px w-4 shrink-0 text-center text-[13px] leading-5 ${step.status === 'active' ? 'animate-pulse' : ''}`} style={{ color: g.color }}>
                    {g.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12.5px] leading-5 ${step.status === 'done' ? 'text-[var(--ink-soft)]' : step.status === 'skipped' ? 'text-[var(--ink-faint)] line-through' : ''}`}>
                      <span className="mr-1.5 font-mono text-[10px] text-[var(--ink-faint)]">{i + 1}.</span>
                      {step.title}
                    </div>
                    {step.note && <div className="mt-0.5 text-[11px] leading-snug text-[var(--ink-faint)]">{step.note}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

function NewGoalForm({
  workspaces,
  onCreated,
  onCancel,
}: {
  workspaces: Array<{ id: string; path: string; name?: string }>;
  onCreated: (run: TrainingRun) => void;
  onCancel?: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
  const [providerId, setProviderId] = useState('');
  const [modelId, setModelId] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (startNow: boolean) => {
    if (!goal.trim()) return;
    setBusy(true);
    const override = providerId && modelId.trim() ? { providerId, modelId: modelId.trim() } : {};
    const input: NewTrainingRun = {
      kind: 'goal',
      name: name.trim() || undefined,
      goal: goal.trim(),
      workspaceId: workspaceId || undefined,
      config: context.trim() ? { extra: context.trim() } : undefined,
      ...override,
    };
    try {
      const run = await window.nekko.createTrainingRun(input);
      if (startNow) await window.nekko.startTrainingRun(run.id);
      onCreated(run);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">New goal</h1>
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
          Something to get finished, not a model to test. The agent maps the work into a plan, executes it step by step, and iterates until it's genuinely done.
        </p>
      </div>

      {/* the loop, so the user knows what they're buying */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { n: '1', t: 'Plan', d: 'The agent studies the goal and writes a concrete step-by-step plan first.' },
          { n: '2', t: 'Execute', d: 'It works the plan, checking off each step as it verifies it done.' },
          { n: '3', t: 'Iterate', d: 'It re-plans when reality disagrees, and keeps going until finished.' },
        ].map((s) => (
          <div key={s.n} className="card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2, var(--accent)))' }}>{s.n}</span>
              <span className="text-[12.5px] font-semibold">{s.t}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--ink-faint)]">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="card space-y-3.5 p-4">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">The goal</label>
          <textarea
            className="input min-h-[64px] w-full resize-y text-[13px]"
            placeholder={'e.g. "Ship the CSV import end to end: parser, validation, tests, docs" or "Migrate the test suite to Vitest with everything green"'}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Name (optional)</label>
            <input className="input w-full" placeholder="CSV import push" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Workspace</label>
            <select className="input w-full" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name ?? w.path}</option>
              ))}
              {workspaces.length === 0 && <option value="">(add a folder from a chat's + menu first)</option>}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Agent model (optional)</label>
          <RunModelPicker providerId={providerId} modelId={modelId} onChange={(n) => { setProviderId(n.providerId); setModelId(n.modelId); }} />
          <p className="mt-1 text-[10.5px] text-[var(--ink-faint)]">The model that drives this goal for hours or days. Leave on App default unless this goal needs a stronger (or cheaper) one.</p>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">Context & constraints (optional)</label>
          <textarea
            className="input min-h-[48px] w-full resize-y text-[12.5px]"
            placeholder={'Anything the plan should respect: "don\'t touch the public API", "deadline beats polish", "use the existing design tokens"'}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button className="btn btn-primary" disabled={!goal.trim() || busy} onClick={() => void create(true)}>
            Create & start
          </button>
          <button className="btn btn-outline" disabled={!goal.trim() || busy} onClick={() => void create(false)}>
            Create as draft
          </button>
          {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}
