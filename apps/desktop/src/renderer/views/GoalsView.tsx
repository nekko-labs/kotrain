import React, { useEffect, useState } from 'react';
import type { NewTrainingRun, TrainingRun } from '@kotrain/shared';
import { APPROACH_PRESETS, formatRuntime, runStats } from '@kotrain/shared';
import { useStore } from '../store.js';
import { ChampionCard, HintComposer, IdeaMaze, RunLog, RunStatTiles, RunStatusChip } from '../components/RunBoard.js';

/**
 * The Goals tab: hand the agent a long-running goal, pick a common ML solving
 * approach, and let it work for hours or days. Built to stay legible over long
 * horizons: a big elapsed/status header, the experiment idea maze, and a
 * prominent activity feed. Course-correct any time: send new ideas or
 * approaches, or point the agent at new data; hints fold into its next turn.
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
      <aside className="flex w-60 shrink-0 flex-col border-r border-(--line)">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[13px] font-semibold">Goals</span>
          <button className="btn btn-primary px-2.5! py-1! text-[12px]" onClick={() => setCreating(true)}>+ New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {mine.length === 0 && (
            <div className="px-2 py-4 text-[12px] text-(--ink-faint)">
              No goals yet. Give the agent a long-running goal and it keeps working, for hours or days, until it's met.
            </div>
          )}
          {mine.map((r) => (
            <button
              key={r.id}
              className={`mb-1 w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-(--surface-2) ${selected?.id === r.id && !creating ? 'bg-(--surface-2)' : ''}`}
              onClick={() => { setSelectedId(r.id); setCreating(false); }}
            >
              <div className="truncate text-[12.5px] font-medium">{r.name}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <RunStatusChip run={r} />
                <span className="font-mono text-[10px] text-(--ink-faint)">{formatRuntime(runStats(r).runtimeMs)}</span>
              </div>
            </button>
          ))}
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
  const approach = APPROACH_PRESETS.find((a) => a.id === run.approachId);
  const remove = () => {
    if (confirm(`Delete goal "${run.name}"? The attempt history is lost.`)) void window.nekko.deleteTrainingRun(run.id);
  };
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {/* long-horizon header: goal, status, big clock */}
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight">{run.name}</h1>
            <RunStatusChip run={run} />
            {approach && <span className="rounded-full border border-(--line) px-2 py-0.5 text-[10.5px] text-(--ink-soft)">{approach.label}</span>}
          </div>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">{run.goal}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-(--ink-faint)">Working for</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: run.status === 'running' ? '#60a5fa' : 'inherit' }}>
            {formatRuntime(s.runtimeMs)}
          </div>
        </div>
        <span className="flex w-full gap-1.5 sm:w-auto">
          {run.status !== 'running' && run.status !== 'completed' && (
            <button className="btn btn-primary py-1.5!" onClick={() => void window.nekko.startTrainingRun(run.id)}>
              {run.turns ? 'Resume' : 'Start'}
            </button>
          )}
          {run.status === 'running' && (
            <button className="btn btn-outline py-1.5!" onClick={() => void window.nekko.pauseTrainingRun(run.id)}>Pause</button>
          )}
          {(run.status === 'running' || run.status === 'paused') && (
            <button className="btn btn-ghost py-1.5! text-red-400" onClick={() => void window.nekko.stopTrainingRun(run.id)}>Stop</button>
          )}
          {run.sessionId && <button className="btn btn-outline py-1.5!" onClick={() => onOpenChat(run.sessionId!)}>Open chat →</button>}
          <button className="btn btn-ghost py-1.5! text-red-400" onClick={remove}>Delete</button>
        </span>
      </div>

      <RunStatTiles run={run} />
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <IdeaMaze run={run} />
          <RunLog run={run} max={120} />
        </div>
        <div className="space-y-3">
          <ChampionCard run={run} />
          <HintComposer
            run={run}
            placeholder='e.g. "that approach plateaued, try ensembling", "fresh data landed in data/march.csv"'
          />
        </div>
      </div>
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
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
  const [approachId, setApproachId] = useState('automl-sweep');
  const [busy, setBusy] = useState(false);

  const create = async (startNow: boolean) => {
    if (!goal.trim()) return;
    setBusy(true);
    const input: NewTrainingRun = {
      kind: 'goal',
      name: name.trim() || undefined,
      goal: goal.trim(),
      approachId,
      workspaceId: workspaceId || undefined,
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
        <p className="mt-1 text-[12.5px] text-(--ink-soft)">
          A long-running objective the agent keeps working toward. Watch the idea maze grow, and steer it whenever you like.
        </p>
      </div>
      <div className="card space-y-3.5 p-4">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-(--ink-faint)">The goal</label>
          <textarea
            className="input min-h-[64px] w-full resize-y text-[13px]"
            placeholder={'e.g. "Get the Kaggle house-prices score above 0.92" or "Reduce the model\'s inference latency below 50ms without losing accuracy"'}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-(--ink-faint)">Name (optional)</label>
            <input className="input w-full" placeholder="House prices push" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-(--ink-faint)">Workspace</label>
            <select className="input w-full" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name ?? w.path}</option>
              ))}
              {workspaces.length === 0 && <option value="">(add a folder in Projects first)</option>}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-(--ink-faint)">Solving approach</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {APPROACH_PRESETS.map((a) => (
              <button
                key={a.id}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${approachId === a.id ? 'border-(--accent) bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]' : 'border-(--line) hover:border-(--ink-faint)'}`}
                onClick={() => setApproachId(a.id)}
              >
                <div className="text-[12.5px] font-semibold">{a.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-(--ink-faint)">{a.blurb}</div>
              </button>
            ))}
          </div>
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
