import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { AgentEvent, ExperimentNode, NewTrainingRun, TrainingRun } from '@kotrain/shared';
import { RUN_DONE_TOKEN, bestExperiment, getApproach, isBetterScore, runStats } from '@kotrain/shared';
import { dataDir, getSettings } from './store.js';
import { getSession, saveSession, createSession, deleteSession } from './sessions.js';
import { sendChat } from './chat.js';

/**
 * Training/goal runs: one engine drives both the Training tab (train a model
 * for a purpose, full expert levers) and the Goals tab (long-running goal
 * solving with an approach preset). A run owns a dedicated chat session; each
 * "turn" the agent plans + executes experiments with the normal tool loop and
 * registers them via the report_experiment tool (handled here). Hints the user
 * adds mid-run are folded into the next turn. State persists to training.json
 * so runs survive restarts (running runs resume on boot).
 */

const TURN_DELAY_MS = 4_000;
const MAX_LOG = 400;

let trainingSender: ((e: AgentEvent) => void) | null = null;
let notify: ((runs: TrainingRun[]) => void) | null = null;
const inFlight = new Set<string>();

export function setTrainingSender(fn: (e: AgentEvent) => void): void {
  trainingSender = fn;
}
export function setTrainingNotifier(fn: (runs: TrainingRun[]) => void): void {
  notify = fn;
}

function file(): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'training.json');
}

function load(): TrainingRun[] {
  try {
    return JSON.parse(readFileSync(file(), 'utf8')) as TrainingRun[];
  } catch {
    return [];
  }
}

function save(runs: TrainingRun[]): void {
  writeFileSync(file(), JSON.stringify(runs, null, 2), 'utf8');
  notify?.(runs);
}

/** Apply a patch by id, re-reading first so concurrent writers don't clobber. */
function persistRun(id: string, mutate: (run: TrainingRun) => void): TrainingRun | undefined {
  const runs = load();
  const run = runs.find((r) => r.id === id);
  if (!run) return undefined;
  mutate(run);
  run.updatedAt = Date.now();
  save(runs);
  return run;
}

function log(run: TrainingRun, kind: 'info' | 'milestone' | 'hint' | 'error', text: string): void {
  run.log.push({ at: Date.now(), kind, text });
  if (run.log.length > MAX_LOG) run.log.splice(0, run.log.length - MAX_LOG);
}

export function listTrainingRuns(): TrainingRun[] {
  return load().sort((a, b) => b.createdAt - a.createdAt);
}

export function createTrainingRun(input: NewTrainingRun): TrainingRun {
  const runs = load();
  const now = Date.now();
  const id = randomUUID();
  const settings = getSettings();
  // Provision the driving chat session up front (like automation tasks) so
  // "Open chat" always works and the run keeps context across turns.
  const session = createSession(input.workspaceId);
  const name = input.name?.trim() || input.goal.slice(0, 48) || (input.kind === 'goal' ? 'New goal' : 'New training run');
  session.title = name;
  session.trainingRunId = id;
  session.providerId = input.providerId ?? settings.defaultProviderId;
  session.modelId = input.modelId ?? settings.defaultModelId;
  saveSession(session);

  const run: TrainingRun = {
    id,
    kind: input.kind,
    name,
    goal: input.goal,
    status: 'draft',
    config: input.config ?? {},
    approachId: input.approachId,
    sessionId: session.id,
    workspaceId: input.workspaceId,
    experiments: [],
    hints: [],
    log: [{ at: now, kind: 'info', text: 'Run created.' }],
    createdAt: now,
    updatedAt: now,
    turns: 0,
  };
  runs.push(run);
  save(runs);
  return run;
}

export function updateTrainingRun(id: string, patch: Partial<TrainingRun>): TrainingRun[] {
  // Only user-editable fields; engine-owned state moves through the loop.
  const allowed: (keyof TrainingRun)[] = ['name', 'goal', 'config', 'approachId', 'workspaceId'];
  persistRun(id, (run) => {
    for (const key of allowed) {
      if (key in patch) (run as unknown as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
    }
  });
  return listTrainingRuns();
}

export function deleteTrainingRun(id: string): TrainingRun[] {
  const runs = load();
  const run = runs.find((r) => r.id === id);
  if (run?.sessionId) {
    const s = getSession(run.sessionId);
    if (s && s.messages.length === 0) deleteSession(s.id);
  }
  save(runs.filter((r) => r.id !== id));
  return listTrainingRuns();
}

export function startTrainingRun(id: string): TrainingRun[] {
  const run = persistRun(id, (r) => {
    if (r.status === 'running') return;
    r.status = 'running';
    r.startedAt = Date.now();
    if (!r.endedAt && r.turns === 0) log(r, 'info', 'Run started.');
    else log(r, 'info', 'Run resumed.');
    r.endedAt = undefined;
  });
  if (run) void tickRun(id);
  return listTrainingRuns();
}

export function pauseTrainingRun(id: string): TrainingRun[] {
  persistRun(id, (r) => {
    if (r.status !== 'running') return;
    stopClock(r);
    r.status = 'paused';
    log(r, 'info', 'Run paused. The current turn finishes, then the agent stops.');
  });
  return listTrainingRuns();
}

export function stopTrainingRun(id: string): TrainingRun[] {
  persistRun(id, (r) => {
    if (r.status === 'completed' || r.status === 'stopped') return;
    stopClock(r);
    r.status = 'stopped';
    r.endedAt = Date.now();
    log(r, 'info', 'Run stopped by the user.');
  });
  return listTrainingRuns();
}

export function addTrainingHint(id: string, text: string): TrainingRun[] {
  const trimmed = text.trim();
  if (trimmed) {
    persistRun(id, (r) => {
      r.hints.push({ id: randomUUID(), text: trimmed, at: Date.now() });
      log(r, 'hint', `Hint queued: ${trimmed.slice(0, 120)}`);
    });
  }
  return listTrainingRuns();
}

/** Fold the elapsed running time into runtimeMs (on pause/stop/finish). */
function stopClock(run: TrainingRun): void {
  if (run.startedAt) {
    run.runtimeMs = (run.runtimeMs ?? 0) + (Date.now() - run.startedAt);
    run.startedAt = undefined;
  }
}

/**
 * Handle a report_experiment tool call from the run's agent session (routed
 * here by chat.ts). Upserts the node, tracks the leader, logs milestones, and
 * tells the agent where it stands.
 */
export function reportExperiment(sessionId: string, input: Record<string, unknown>): string {
  const runs = load();
  const run = runs.find((r) => r.sessionId === sessionId);
  if (!run) return 'No active run is linked to this session; the experiment was not recorded.';

  const now = Date.now();
  const status = String(input.status ?? 'running') as ExperimentNode['status'];
  const valid: ExperimentNode['status'][] = ['planned', 'running', 'succeeded', 'failed', 'repaired'];
  if (!valid.includes(status)) return `Unknown status "${status}". Use one of: ${valid.join(', ')}.`;

  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `exp_${run.experiments.length + 1}`;
  let node = run.experiments.find((e) => e.id === id);
  if (!node) {
    node = { id, title: '', status, createdAt: now, updatedAt: now };
    run.experiments.push(node);
  }
  node.title = String(input.title ?? node.title ?? id).slice(0, 120);
  node.status = status;
  node.updatedAt = now;
  if (typeof input.parent_id === 'string' && input.parent_id.trim() && input.parent_id !== id) node.parentId = input.parent_id.trim();
  if (typeof input.approach === 'string' && input.approach.trim()) node.approach = input.approach.trim().slice(0, 60);
  if (typeof input.metric === 'string' && input.metric.trim()) node.metric = input.metric.trim().slice(0, 40);
  if (typeof input.note === 'string' && input.note.trim()) node.note = input.note.trim().slice(0, 300);

  let reply: string;
  const minimize = run.config?.minimizeMetric;
  const leaderBefore = run.bestExperimentId ? run.experiments.find((e) => e.id === run.bestExperimentId) : bestExperiment(run);
  if (typeof input.score === 'number' && Number.isFinite(input.score)) {
    node.score = input.score;
    if (!leaderBefore || leaderBefore.id === node.id || isBetterScore(input.score, leaderBefore.score, minimize)) {
      run.bestExperimentId = node.id;
      log(run, 'milestone', `New leader: ${node.title} scored ${input.score}${node.metric ? ` (${node.metric})` : ''}.`);
      reply = `Recorded ${id}. It is the new leader at ${input.score}.`;
    } else {
      log(run, 'info', `Experiment ${id} (${node.title}) scored ${input.score}, not better than the leader (${leaderBefore.score}).`);
      reply = `Recorded ${id} at ${input.score}. Leader remains ${leaderBefore.id} (${leaderBefore.title}) at ${leaderBefore.score}.`;
    }
  } else {
    if (status === 'failed') log(run, 'error', `Experiment ${id} (${node.title}) failed${node.note ? `: ${node.note}` : '.'}`);
    else if (status === 'repaired') log(run, 'milestone', `Experiment ${id} (${node.title}) was self-repaired.`);
    const leader = run.bestExperimentId ? run.experiments.find((e) => e.id === run.bestExperimentId) : undefined;
    reply = `Recorded ${id} (${status}).${leader?.score != null ? ` Leader is ${leader.id} (${leader.title}) at ${leader.score}.` : ''}`;
  }

  run.updatedAt = now;
  save(runs);
  return reply;
}

/** Compact tree summary the agent sees each turn (title, lineage, score). */
function treeBrief(run: TrainingRun): string {
  if (run.experiments.length === 0) return 'No experiments recorded yet.';
  const lines = run.experiments
    .slice(-40)
    .map((e) => {
      const score = e.score != null ? ` score=${e.score}` : '';
      const parent = e.parentId ? ` parent=${e.parentId}` : '';
      const star = e.id === run.bestExperimentId ? ' ★leader' : '';
      return `- ${e.id}${parent} [${e.status}]${score}${star} ${e.title}${e.note ? ` — ${e.note}` : ''}`;
    });
  const s = runStats(run);
  return `${run.experiments.length} experiments so far (best=${s.best ?? 'n/a'}, success rate=${s.successRate != null ? Math.round(s.successRate * 100) + '%' : 'n/a'}):\n${lines.join('\n')}`;
}

/** The per-turn brief for a run's agent. */
function turnPrompt(run: TrainingRun, hints: string[]): string {
  const cfg = run.config ?? {};
  const parts: string[] = [];

  if ((run.turns ?? 0) === 0) {
    if (run.kind === 'training') {
      parts.push(
        `You are Kotrain's data-scientist agent. Your job is to actually train a model for this purpose, working hands-on in the workspace (write code, run it with the bash tool, prefer Python; set up a venv or use available tooling; install packages as needed).`,
        `PURPOSE: ${run.goal}`,
      );
      const d = cfg.dataset;
      if (d) parts.push(`DATASET: ${d.source}:${d.id}${d.split ? ` (split: ${d.split})` : ''}${d.source === 'huggingface' ? ' — load via the datasets library.' : d.source === 'kaggle' ? ' — download via the kaggle CLI (needs KAGGLE_* creds; if missing, say so in a report note and continue with an alternative if possible).' : ''}`);
      const b = cfg.baseModel;
      if (b && b.source !== 'none') parts.push(`BASE MODEL: ${b.source}:${b.id ?? ''} — start from it (fine-tune / adapt) where sensible, but compare against a simpler baseline.`);
      const levers: string[] = [];
      if (cfg.framework && cfg.framework !== 'auto') levers.push(`framework=${cfg.framework}`);
      if (cfg.epochs) levers.push(`epochs≈${cfg.epochs}`);
      if (cfg.batchSize) levers.push(`batch=${cfg.batchSize}`);
      if (cfg.learningRate) levers.push(`lr≈${cfg.learningRate}`);
      if (levers.length) parts.push(`EXPERT LEVERS: ${levers.join(', ')} (treat as strong defaults, note deviations).`);
      if (cfg.metric) parts.push(`METRIC: optimize ${cfg.metric}${cfg.minimizeMetric ? ' (lower is better)' : ' (higher is better)'}; measure with cross-validation or a held-out split.`);
      const h = cfg.harness ?? {};
      const artifacts = [h.agentsMd && 'an AGENTS.md agent file describing how an agent should use the model', h.skill && 'a SKILL.md skill wrapping common usage', h.spec && 'a SPEC.md describing the model, its data, metrics, and intended use'].filter(Boolean);
      if (artifacts.length) parts.push(`HARNESS: when the run completes, also produce ${artifacts.join('; ')} in the output folder, tailored to the purpose.`);
    } else {
      parts.push(
        `You are Kotrain's goal-solver agent. You own a long-running goal and work it in iterations until it is genuinely met, working hands-on in the workspace with your tools.`,
        `GOAL: ${run.goal}`,
      );
      const approach = getApproach(run.approachId);
      if (approach?.hint) parts.push(`APPROACH: ${approach.label} — ${approach.hint}`);
    }
    parts.push(
      `RULES: (1) Work in small, measurable experiments. Call report_experiment when an attempt STARTS (status "running") and when it ENDS (succeeded/failed/repaired, with score when measurable), using parent_id to show what you branched from and "approach" to name the idea family. (2) If something breaks, fix it and mark the experiment "repaired" rather than silently retrying. (3) Keep artifacts in a "${run.kind === 'training' ? 'kotrain-training' : 'kotrain-goal'}/${run.name.replace(/[^a-z0-9-_ ]/gi, '').slice(0, 30).trim() || run.id.slice(0, 8)}" folder in the workspace. (4) Between turns you lose nothing: this chat keeps your context. (5) When the ${run.kind === 'training' ? 'purpose is fulfilled (model trained + artifacts written)' : 'goal is fully met'}${cfg.maxExperiments ? `, or you have exhausted ~${cfg.maxExperiments} experiments` : ''}${cfg.timeBudgetMin ? `, or the ~${cfg.timeBudgetMin} minute budget` : ''}, summarize the outcome and end your reply with ${RUN_DONE_TOKEN}.`,
    );
    if (cfg.extra) parts.push(`EXPERT NOTES: ${cfg.extra}`);
    parts.push(`Start now: profile the task, form a short plan, and run your first experiments.`);
  } else {
    parts.push(`Continue the run. Current experiment tree:\n${treeBrief(run)}`);
    parts.push(`Push the leader further: iterate on what works, branch new idea families when progress stalls, repair failures. Keep calling report_experiment. End with ${RUN_DONE_TOKEN} only when the ${run.kind === 'training' ? 'purpose' : 'goal'} is genuinely met or budgets are exhausted.`);
  }

  if (hints.length) {
    parts.push(`USER GUIDANCE (fold these into your next experiments; acknowledge each):\n${hints.map((h) => `- ${h}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

/** Drive one agent turn for a run, then re-arm while it stays running. */
async function tickRun(id: string): Promise<void> {
  if (inFlight.has(id)) return;
  const run = load().find((r) => r.id === id);
  if (!run || run.status !== 'running') return;

  const settings = getSettings();
  const session = run.sessionId ? getSession(run.sessionId) : null;
  const providerId = session?.providerId ?? settings.defaultProviderId;
  const modelId = session?.modelId ?? settings.defaultModelId;
  if (!session || !providerId || !modelId) {
    persistRun(id, (r) => {
      r.status = 'failed';
      stopClock(r);
      log(r, 'error', 'No model configured. Set a default provider/model in Models, then start the run again.');
    });
    return;
  }

  // Consume pending hints into this turn.
  const hints: string[] = [];
  persistRun(id, (r) => {
    for (const h of r.hints) {
      if (!h.consumedAt) {
        h.consumedAt = Date.now();
        hints.push(h.text);
      }
    }
  });

  const fresh = load().find((r) => r.id === id);
  if (!fresh) return;
  const prompt = turnPrompt(fresh, hints);

  inFlight.add(id);
  persistRun(id, (r) => {
    r.turns = (r.turns ?? 0) + 1;
  });
  try {
    await sendChat({ sessionId: session.id, providerId, modelId, text: prompt }, (e) => trainingSender?.(e));
    const done = getSession(session.id);
    const last = [...(done?.messages ?? [])].reverse().find((m) => m.role === 'assistant' && m.content.trim());
    const finished = !!last?.content.includes(RUN_DONE_TOKEN);
    persistRun(id, (r) => {
      if (finished && r.status === 'running') {
        stopClock(r);
        r.status = 'completed';
        r.endedAt = Date.now();
        log(r, 'milestone', `Run completed: ${last!.content.replace(RUN_DONE_TOKEN, '').trim().slice(0, 200)}`);
      }
    });
  } catch (e) {
    persistRun(id, (r) => {
      log(r, 'error', `Turn failed: ${(e as Error).message}`);
    });
  } finally {
    inFlight.delete(id);
  }

  // Re-arm while still running (pause/stop flips status mid-turn).
  const after = load().find((r) => r.id === id);
  if (after?.status === 'running') {
    const t = setTimeout(() => void tickRun(id), TURN_DELAY_MS);
    (t as unknown as { unref?: () => void }).unref?.();
  }
}

/** Resume runs that were mid-flight when the host went down (idempotent). */
export function startTrainingScheduler(): void {
  for (const run of load()) {
    if (run.status === 'running') {
      persistRun(run.id, (r) => {
        r.startedAt = Date.now();
        log(r, 'info', 'Host restarted; run resumed automatically.');
      });
      void tickRun(run.id);
    }
  }
}
