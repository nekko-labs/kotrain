import { getClient, resolveModel, runChat, type Client } from './lib.js';

/**
 * MCP stdio server exposing Kotrain to other tools (Claude Code, Codex, …).
 * Hand-rolled JSON-RPC 2.0 over newline-delimited stdio, the MCP stdio
 * transport. Other agents can trigger this machine's agent, make chat requests,
 * spin up sessions (swarm by calling chat across several sessions), and read
 * status, all driving the local model.
 */

const VERSION = '0.1.5';

const TOOLS = [
  {
    name: 'open_paw_chat',
    description:
      "Run an agent turn on this machine's Kotrain (reads/edits/searches/runs in the configured workspace, using the local or cloud model). Returns the assistant's reply. Omit sessionId to start a fresh session.",
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to ask / tell the agent.' },
        sessionId: { type: 'string', description: 'Continue an existing chat (optional).' },
        workspaceId: { type: 'string', description: 'Workspace/project to scope a new chat to (optional).' },
        provider: { type: 'string', description: 'Provider id override (optional).' },
        model: { type: 'string', description: 'Model id override (optional).' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'open_paw_list_sessions',
    description: 'List chat sessions (id, title, message count, last updated).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'open_paw_new_session',
    description: 'Create a new chat session and return its id.',
    inputSchema: { type: 'object', properties: { workspaceId: { type: 'string' } } },
  },
  {
    name: 'open_paw_get_session',
    description: 'Get a session transcript (user/assistant messages).',
    inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
  },
  {
    name: 'open_paw_train_start',
    description:
      "Ask this machine's Kotrain to train a model for a purpose. Creates and starts a training run: a local data-scientist agent works hands-on in the workspace (benchmark candidate models, prepare data, fine-tune, evaluate), reporting each experiment with its score to an experiment tree. Returns the run id; poll open_paw_train_status.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short run name, e.g. "mynichi-slm-v1".' },
        goal: { type: 'string', description: 'What to train and what metric to maximize/minimize, in plain language.' },
        kind: { type: 'string', enum: ['training', 'goal'], description: 'Run type (default "training").' },
        workspaceId: { type: 'string', description: 'Workspace the agent works in (see open_paw_status).' },
        provider: { type: 'string', description: 'Provider id override for the agent model (optional).' },
        model: { type: 'string', description: 'Model id override for the agent model (optional).' },
        metric: { type: 'string', description: 'Metric name experiments report, e.g. "score" or "accuracy".' },
        minimizeMetric: { type: 'boolean', description: 'True if lower is better (default false).' },
        maxExperiments: { type: 'number', description: 'Budget hint: stop after this many experiments.' },
        timeBudgetMin: { type: 'number', description: 'Budget hint: total minutes.' },
        extra: { type: 'string', description: 'Expert notes appended verbatim to the agent brief (exact commands, constraints, search space).' },
      },
      required: ['name', 'goal'],
    },
  },
  {
    name: 'open_paw_train_status',
    description:
      'Status of training runs: experiments with scores, the current leader, run state. Pass runId for one run in detail, omit for a summary of all runs.',
    inputSchema: { type: 'object', properties: { runId: { type: 'string' } } },
  },
  {
    name: 'open_paw_train_hint',
    description: 'Queue user guidance for a running training run; the agent folds it into its next experiments.',
    inputSchema: {
      type: 'object',
      properties: { runId: { type: 'string' }, text: { type: 'string' } },
      required: ['runId', 'text'],
    },
  },
  {
    name: 'open_paw_train_stop',
    description: 'Stop a training run (the in-flight turn finishes, then the run ends).',
    inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] },
  },
  {
    name: 'open_paw_status',
    description: 'Summary of this Kotrain: providers, default model, workspaces, session count, remote relay status.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(client: Client, name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case 'open_paw_chat': {
      let sessionId = args.sessionId as string | undefined;
      if (!sessionId) sessionId = (await client.createSession(args.workspaceId)).id;
      const session = await client.getSession(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);
      const settings = await client.getSettings();
      const { providerId, modelId } = resolveModel(settings, {
        provider: args.provider,
        model: args.model,
        sessionProvider: session.providerId,
        sessionModel: session.modelId,
      });
      const reply = await runChat(client, { sessionId, providerId, modelId, text: String(args.prompt ?? '') });
      return `session: ${sessionId}\n\n${reply}`;
    }
    case 'open_paw_list_sessions':
      return JSON.stringify(
        (await client.listSessions()).map((s) => ({ id: s.id, title: s.title, messages: s.messages.length, updatedAt: s.updatedAt })),
        null,
        2,
      );
    case 'open_paw_new_session':
      return `Created session ${(await client.createSession(args.workspaceId)).id}`;
    case 'open_paw_get_session': {
      const s = await client.getSession(String(args.sessionId));
      if (!s) throw new Error('Session not found');
      return s.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => `## ${m.role}\n${m.content}`)
        .join('\n\n');
    }
    case 'open_paw_train_start': {
      const run = await client.createTrainingRun({
        kind: (args.kind as 'training' | 'goal') ?? 'training',
        name: String(args.name),
        goal: String(args.goal),
        workspaceId: args.workspaceId,
        providerId: args.provider,
        modelId: args.model,
        config: {
          metric: args.metric,
          minimizeMetric: args.minimizeMetric,
          maxExperiments: args.maxExperiments,
          timeBudgetMin: args.timeBudgetMin,
          extra: args.extra,
        },
      });
      // Headless run: never block on tool-approval prompts nobody can click.
      if (run.sessionId) await client.setSessionOptions(run.sessionId, { mode: 'yolo' });
      await client.startTrainingRun(run.id);
      return JSON.stringify({ runId: run.id, sessionId: run.sessionId, status: 'running' }, null, 2);
    }
    case 'open_paw_train_status': {
      const runs = await client.listTrainingRuns();
      if (args.runId) {
        const run = runs.find((r) => r.id === args.runId);
        if (!run) throw new Error(`Run ${args.runId} not found`);
        const best = run.experiments.find((e) => e.id === run.bestExperimentId);
        return JSON.stringify(
          {
            id: run.id,
            name: run.name,
            status: run.status,
            turns: run.turns ?? 0,
            best: best ? { id: best.id, title: best.title, score: best.score } : null,
            experiments: run.experiments.map((e) => ({
              id: e.id,
              title: e.title,
              status: e.status,
              score: e.score,
              note: e.note,
            })),
          },
          null,
          2,
        );
      }
      return JSON.stringify(
        runs.map((r) => {
          const best = r.experiments.find((e) => e.id === r.bestExperimentId);
          return { id: r.id, name: r.name, status: r.status, experiments: r.experiments.length, best: best?.score ?? null };
        }),
        null,
        2,
      );
    }
    case 'open_paw_train_hint': {
      await client.addTrainingHint(String(args.runId), String(args.text));
      return `Hint queued for ${args.runId}.`;
    }
    case 'open_paw_train_stop': {
      await client.stopTrainingRun(String(args.runId));
      return `Run ${args.runId} stopping.`;
    }
    case 'open_paw_status': {
      const [s, sessions, remote] = await Promise.all([client.getSettings(), client.listSessions(), client.remoteStatus()]);
      return JSON.stringify(
        {
          providers: s.providers.map((p) => ({ id: p.id, label: p.label, kind: p.kind })),
          defaultModel: s.defaultModelId ?? null,
          workspaces: s.workspaces.map((w) => ({ id: w.id, name: w.name, path: w.path })),
          sessions: sessions.length,
          remote,
        },
        null,
        2,
      );
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function runMcpServer(opts: { url?: string; token?: string } = {}): void {
  // Protect the stdout protocol stream: route any stray logs to stderr.
  console.log = (...a: unknown[]) => console.error(...a);
  const client = getClient(opts);
  let buffer = '';

  const send = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + '\n');
  const ok = (id: unknown, result: unknown) => send({ jsonrpc: '2.0', id, result });
  const err = (id: unknown, message: string) => send({ jsonrpc: '2.0', id, error: { code: -32000, message } });

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      handle(msg);
    }
  });

  async function handle(msg: any) {
    const { id, method, params } = msg;
    if (method === 'initialize') {
      ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'kotrain', version: VERSION } });
    } else if (method === 'notifications/initialized' || method?.startsWith('notifications/')) {
      /* notifications: no response */
    } else if (method === 'ping') {
      ok(id, {});
    } else if (method === 'tools/list') {
      ok(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      try {
        const text = await callTool(client, params?.name, params?.arguments ?? {});
        ok(id, { content: [{ type: 'text', text }] });
      } catch (e) {
        ok(id, { content: [{ type: 'text', text: `Error: ${(e as Error).message}` }], isError: true });
      }
    } else if (id !== undefined) {
      err(id, `Unknown method: ${method}`);
    }
  }

  console.error('[kotrain] MCP server ready on stdio');
}
