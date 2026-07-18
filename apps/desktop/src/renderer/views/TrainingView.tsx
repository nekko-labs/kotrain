import React, { useEffect, useState } from 'react';
import type { DatasetRef, BaseModelRef, NewTrainingRun, TrainingConfig, TrainingRun } from '@kotrain/shared';
import { useStore } from '../store.js';
import { ChampionCard, HintComposer, IdeaMaze, RunLog, RunStatTiles, RunStatusChip } from '../components/RunBoard.js';

/**
 * The Training tab: train a model in a simple UI that abstracts the complexity
 * away (purpose + dataset + base model) while exposing full expert levers.
 * A data-scientist agent does the actual work in a dedicated chat session; the
 * dashboard shows its live progression: stats, the experiment idea maze,
 * successes/failures, and a guidance composer for mid-run hints. Distinctive:
 * a run can also produce the harness for the model's use case (agent file,
 * skill, spec) alongside the model itself.
 */
export function TrainingView() {
  const { settings, openChatPane, setView } = useStore();
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void window.nekko.listTrainingRuns().then(setRuns);
    return window.nekko.onTrainingUpdated(setRuns);
  }, []);

  const mine = runs.filter((r) => r.kind === 'training');
  const selected = mine.find((r) => r.id === selectedId) ?? mine[0] ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* run list */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-(--line)">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[13px] font-semibold">Training runs</span>
          <button className="btn btn-primary px-2.5! py-1! text-[12px]" onClick={() => setCreating(true)}>+ New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {mine.length === 0 && (
            <div className="px-2 py-4 text-[12px] text-(--ink-faint)">
              No training runs yet. Describe what you want a model for, point at a dataset, and the agent trains it while you watch.
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
                <span className="font-mono text-[10px] text-(--ink-faint)">{r.experiments.length} exp</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* main */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {creating || !selected ? (
          <NewRunForm
            workspaces={settings?.workspaces ?? []}
            onCreated={(run) => { setSelectedId(run.id); setCreating(false); }}
            onCancel={mine.length ? () => setCreating(false) : undefined}
          />
        ) : (
          <RunDashboard run={selected} onOpenChat={(sid) => { openChatPane(sid); setView('chat'); }} />
        )}
      </div>
    </div>
  );
}

function RunDashboard({ run, onOpenChat }: { run: TrainingRun; onOpenChat: (sessionId: string) => void }) {
  const start = () => void window.nekko.startTrainingRun(run.id);
  const pause = () => void window.nekko.pauseTrainingRun(run.id);
  const stop = () => void window.nekko.stopTrainingRun(run.id);
  const remove = () => {
    if (confirm(`Delete run "${run.name}"? The experiment history is lost.`)) void window.nekko.deleteTrainingRun(run.id);
  };
  const cfg = run.config ?? {};
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="mr-1 text-lg font-bold tracking-tight">{run.name}</h1>
        <RunStatusChip run={run} />
        <span className="ml-auto flex gap-1.5">
          {run.status !== 'running' && run.status !== 'completed' && (
            <button className="btn btn-primary py-1.5!" onClick={start}>{run.turns ? 'Resume' : 'Start training'}</button>
          )}
          {run.status === 'running' && <button className="btn btn-outline py-1.5!" onClick={pause}>Pause</button>}
          {(run.status === 'running' || run.status === 'paused') && (
            <button className="btn btn-ghost py-1.5! text-red-400" onClick={stop}>Stop</button>
          )}
          {run.sessionId && (
            <button className="btn btn-outline py-1.5!" onClick={() => onOpenChat(run.sessionId!)}>Open chat →</button>
          )}
          <button className="btn btn-ghost py-1.5! text-red-400" onClick={remove}>Delete</button>
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-(--ink-soft)">
        <span className="max-w-full"><b className="text-(--ink)">Purpose:</b> {run.goal}</span>
        {cfg.dataset?.id && <span><b className="text-(--ink)">Dataset:</b> {cfg.dataset.source}:{cfg.dataset.id}</span>}
        {cfg.baseModel?.id && cfg.baseModel.source !== 'none' && <span><b className="text-(--ink)">Base model:</b> {cfg.baseModel.id}</span>}
        {cfg.metric && <span><b className="text-(--ink)">Metric:</b> {cfg.metric}{cfg.minimizeMetric ? ' ↓' : ' ↑'}</span>}
        {(cfg.harness?.agentsMd || cfg.harness?.skill || cfg.harness?.spec) && (
          <span><b className="text-(--ink)">Harness:</b> {[cfg.harness.agentsMd && 'agent file', cfg.harness.skill && 'skill', cfg.harness.spec && 'spec'].filter(Boolean).join(', ')}</span>
        )}
      </div>

      <RunStatTiles run={run} />
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <IdeaMaze run={run} />
        <div className="space-y-3">
          <ChampionCard run={run} />
          <HintComposer run={run} placeholder='e.g. "try gradient boosting", "the date column leaks the target", "more augmentation"' />
        </div>
      </div>
      <RunLog run={run} />
    </div>
  );
}

function NewRunForm({
  workspaces,
  onCreated,
  onCancel,
}: {
  workspaces: Array<{ id: string; path: string; name?: string }>;
  onCreated: (run: TrainingRun) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
  const [dsSource, setDsSource] = useState<DatasetRef['source']>('huggingface');
  const [dsId, setDsId] = useState('');
  const [bmSource, setBmSource] = useState<BaseModelRef['source']>('none');
  const [bmId, setBmId] = useState('');
  const [metric, setMetric] = useState('');
  const [minimize, setMinimize] = useState(false);
  const [harness, setHarness] = useState({ agentsMd: true, skill: false, spec: true });
  // expert levers
  const [framework, setFramework] = useState<NonNullable<TrainingConfig['framework']>>('auto');
  const [epochs, setEpochs] = useState('');
  const [batch, setBatch] = useState('');
  const [lr, setLr] = useState('');
  const [maxExp, setMaxExp] = useState('');
  const [budget, setBudget] = useState('');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (startNow: boolean) => {
    if (!goal.trim()) return;
    setBusy(true);
    const config: TrainingConfig = {
      ...(dsId.trim() ? { dataset: { source: dsSource, id: dsId.trim() } } : {}),
      ...(bmSource !== 'none' && bmId.trim() ? { baseModel: { source: bmSource, id: bmId.trim() } } : { baseModel: { source: 'none' } }),
      ...(metric.trim() ? { metric: metric.trim(), minimizeMetric: minimize } : {}),
      ...(framework !== 'auto' ? { framework } : {}),
      ...(epochs ? { epochs: Number(epochs) } : {}),
      ...(batch ? { batchSize: Number(batch) } : {}),
      ...(lr ? { learningRate: Number(lr) } : {}),
      ...(maxExp ? { maxExperiments: Number(maxExp) } : {}),
      ...(budget ? { timeBudgetMin: Number(budget) } : {}),
      ...(extra.trim() ? { extra: extra.trim() } : {}),
      harness,
    };
    const input: NewTrainingRun = {
      kind: 'training',
      name: name.trim() || undefined,
      goal: goal.trim(),
      config,
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

  const L = ({ children }: { children: React.ReactNode }) => (
    <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-(--ink-faint)">{children}</label>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">New training run</h1>
        <p className="mt-1 text-[12.5px] text-(--ink-soft)">
          Say what the model is for; the agent handles the rest. Every attempt shows up live in the idea maze, and you can steer it mid-run.
        </p>
      </div>

      <div className="card space-y-3.5 p-4">
        <div>
          <L>Purpose — what should this model do?</L>
          <textarea
            className="input min-h-[64px] w-full resize-y text-[13px]"
            placeholder='e.g. "Classify customer support tickets by urgency" or "Predict house prices from the tabular features"'
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <L>Name (optional)</L>
            <input className="input w-full" placeholder="Ticket urgency v1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <L>Workspace</L>
            <select className="input w-full" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name ?? w.path}</option>
              ))}
              {workspaces.length === 0 && <option value="">(add a folder in Projects first)</option>}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <L>Dataset</L>
            <div className="flex gap-1.5">
              <select className="input w-32 shrink-0" value={dsSource} onChange={(e) => setDsSource(e.target.value as DatasetRef['source'])}>
                <option value="huggingface">🤗 HF</option>
                <option value="kaggle">Kaggle</option>
                <option value="local">Local</option>
                <option value="url">URL</option>
              </select>
              <input
                className="input w-full"
                placeholder={dsSource === 'huggingface' ? 'imdb, glue, user/dataset…' : dsSource === 'kaggle' ? 'owner/competition-or-dataset' : dsSource === 'local' ? 'path in the workspace' : 'https://…'}
                value={dsId}
                onChange={(e) => setDsId(e.target.value)}
              />
            </div>
          </div>
          <div>
            <L>Base model</L>
            <div className="flex gap-1.5">
              <select className="input w-32 shrink-0" value={bmSource} onChange={(e) => setBmSource(e.target.value as BaseModelRef['source'])}>
                <option value="none">From scratch</option>
                <option value="huggingface">🤗 HF</option>
                <option value="local">Local</option>
              </select>
              {bmSource !== 'none' && (
                <input className="input w-full" placeholder="distilbert-base-uncased…" value={bmId} onChange={(e) => setBmId(e.target.value)} />
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <L>Metric (optional)</L>
            <div className="flex items-center gap-2">
              <input className="input w-full" placeholder="accuracy, f1, r2, rmse…" value={metric} onChange={(e) => setMetric(e.target.value)} />
              <label className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-(--ink-soft)">
                <input type="checkbox" checked={minimize} onChange={(e) => setMinimize(e.target.checked)} /> lower is better
              </label>
            </div>
          </div>
          <div>
            <L>Harness for the use case</L>
            <div className="flex flex-wrap gap-3 pt-1.5 text-[12px]">
              {([['agentsMd', 'Agent file'], ['skill', 'Skill'], ['spec', 'Spec']] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={harness[k]}
                    onChange={(e) => setHarness({ ...harness, [k]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <details className="rounded-lg border border-(--line) px-3 py-2">
          <summary className="cursor-pointer select-none font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--ink-faint)">
            Expert levers
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <L>Framework</L>
              <select className="input w-full" value={framework} onChange={(e) => setFramework(e.target.value as typeof framework)}>
                <option value="auto">Auto</option>
                <option value="sklearn">scikit-learn</option>
                <option value="pytorch">PyTorch</option>
                <option value="transformers">Transformers</option>
              </select>
            </div>
            <div><L>Epochs</L><input className="input w-full" type="number" min="1" value={epochs} onChange={(e) => setEpochs(e.target.value)} /></div>
            <div><L>Batch size</L><input className="input w-full" type="number" min="1" value={batch} onChange={(e) => setBatch(e.target.value)} /></div>
            <div><L>Learning rate</L><input className="input w-full" type="number" step="any" value={lr} onChange={(e) => setLr(e.target.value)} /></div>
            <div><L>Max experiments</L><input className="input w-full" type="number" min="1" value={maxExp} onChange={(e) => setMaxExp(e.target.value)} /></div>
            <div><L>Time budget (min)</L><input className="input w-full" type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            <div className="sm:col-span-3">
              <L>Extra instructions</L>
              <textarea className="input min-h-[48px] w-full resize-y text-[12.5px]" placeholder="Anything else the agent must honor (splits, constraints, hardware, library versions…)" value={extra} onChange={(e) => setExtra(e.target.value)} />
            </div>
          </div>
        </details>

        <div className="flex gap-2 pt-1">
          <button className="btn btn-primary" disabled={!goal.trim() || busy} onClick={() => void create(true)}>
            Create & start training
          </button>
          <button className="btn btn-outline" disabled={!goal.trim() || busy} onClick={() => void create(false)}>
            Create as draft
          </button>
          {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        </div>
        <p className="text-[11px] text-(--ink-faint)">
          Uses your default provider/model (change it later from the run's chat). Hugging Face datasets load via the datasets library; Kaggle needs your KAGGLE credentials configured on this machine.
        </p>
      </div>
    </div>
  );
}
