import { describe, it, expect, vi } from 'vitest';
import { runAgent, windowHistory } from './loop.js';
import type { ChatRequest, Provider, ProviderChunk } from '../providers/types.js';
import type { ChatMessage, ToolCall, ToolResult } from '@nekkos/shared';

/** A user/assistant message pair helper for building histories. */
function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: `${role}_${content}`, role, content, createdAt: 0 };
}

/** A scripted provider: each call to chat() yields the next pre-set chunk list. */
function scriptedProvider(rounds: ProviderChunk[][]): Provider {
  let i = 0;
  return {
    config: { id: 'p', kind: 'openai-compat', label: 'x', baseUrl: 'x', enabled: true },
    listModels: async () => [],
    test: async () => ({ ok: true, message: '' }),
    async *chat() {
      const chunks = rounds[i++] ?? [{ type: 'done' }];
      for (const c of chunks) yield c;
    },
  };
}

describe('runAgent', () => {
  it('streams text and completes when no tools are called', async () => {
    const provider = scriptedProvider([
      [{ type: 'text', delta: 'Hello' }, { type: 'text', delta: ' world' }, { type: 'done' }],
    ]);
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'hi', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history,
      executeTool: async () => ({ toolCallId: 'x', output: '' }),
    })) {
      events.push(e);
    }
    expect(events.filter((e) => e.type === 'text').map((e: any) => e.delta).join('')).toBe('Hello world');
    expect(events.at(-1)?.type).toBe('done');
    // Assistant message appended to history.
    expect(history.at(-1)).toMatchObject({ role: 'assistant', content: 'Hello world' });
  });

  it('executes tool calls and feeds results back, then finishes', async () => {
    const call: ToolCall = { id: 'c1', name: 'read_file', input: { path: 'a.ts' } };
    const provider = scriptedProvider([
      [{ type: 'tool_call', call }, { type: 'done' }], // round 1: call a tool
      [{ type: 'text', delta: 'done reading' }, { type: 'done' }], // round 2: final answer
    ]);
    const executeTool = vi.fn(async (c: ToolCall): Promise<ToolResult> => ({
      toolCallId: c.id, output: 'file contents',
    }));
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'read it', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history, executeTool,
    })) {
      events.push(e);
    }
    expect(executeTool).toHaveBeenCalledOnce();
    expect(events.some((e) => e.type === 'tool_call')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    // History contains: user, assistant(toolCall), tool(result), assistant(final).
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(history.at(-1)?.content).toBe('done reading');
  });

  it('surfaces tool execution errors without throwing', async () => {
    const call: ToolCall = { id: 'c1', name: 'bash', input: { command: 'x' } };
    const provider = scriptedProvider([
      [{ type: 'tool_call', call }, { type: 'done' }],
      [{ type: 'text', delta: 'ok' }, { type: 'done' }],
    ]);
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'go', createdAt: 0 }];
    const results: ToolResult[] = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history,
      executeTool: async () => {
        throw new Error('boom');
      },
    })) {
      if (e.type === 'tool_result') results.push(e.result);
    }
    expect(results[0].isError).toBe(true);
    expect(results[0].output).toContain('boom');
  });

  it('forwards reasoning chunks as reasoning events', async () => {
    const provider = scriptedProvider([
      [{ type: 'reasoning', delta: 'thinking' }, { type: 'text', delta: 'ans' }, { type: 'done' }],
    ]);
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'q', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history,
      executeTool: async () => ({ toolCallId: 'x', output: '' }),
    })) {
      events.push(e);
    }
    expect(events.some((e) => e.type === 'reasoning' && (e as any).delta === 'thinking')).toBe(true);
  });

  it('retries once with a nudge when the model returns an empty response', async () => {
    // Round 1: the model stops cold (finish_reason "stop", nothing produced).
    // Round 2 (the nudged retry): a real answer.
    const provider = scriptedProvider([
      [{ type: 'done' }],
      [{ type: 'text', delta: 'recovered' }, { type: 'done' }],
    ]);
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'hi', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history,
      executeTool: async () => ({ toolCallId: 'x', output: '' }),
    })) {
      events.push(e);
    }
    // The recovered text is what lands, and the nudge is not persisted.
    expect(history.at(-1)).toMatchObject({ role: 'assistant', content: 'recovered' });
    expect(history.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('surfaces a clear marker when the model stays empty after the retry', async () => {
    const provider = scriptedProvider([[{ type: 'done' }], [{ type: 'done' }]]);
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'hi', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history,
      executeTool: async () => ({ toolCallId: 'x', output: '' }),
    })) {
      events.push(e);
    }
    expect(events.at(-1)?.type).toBe('done');
    expect(history.at(-1)?.role).toBe('assistant');
    expect(history.at(-1)?.content).toContain('empty response');
  });

  it('wraps up with an answer (not an error) when the step budget runs out', async () => {
    // A model that never stops calling tools while it has any, and answers once
    // they're withheld, exactly the shape of the wrap-up pass.
    const toolRounds: ChatRequest[] = [];
    const provider: Provider = {
      config: { id: 'p', kind: 'openai-compat', label: 'x', baseUrl: 'x', enabled: true },
      listModels: async () => [],
      test: async () => ({ ok: true, message: '' }),
      async *chat(req: ChatRequest) {
        toolRounds.push(req);
        if (req.tools?.length) {
          yield { type: 'tool_call', call: { id: `c${toolRounds.length}`, name: 'read_file', input: {} } } as ProviderChunk;
        } else {
          yield { type: 'text', delta: 'here is what I found so far' } as ProviderChunk;
        }
        yield { type: 'done' } as ProviderChunk;
      },
    };
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'explore', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history, maxIterations: 3,
      executeTool: async (c) => ({ toolCallId: c.id, output: 'contents' }),
    })) {
      events.push(e);
    }
    // The reply survives: no error, a done event, and the model's own summary.
    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(events.at(-1)?.type).toBe('done');
    expect(history.at(-1)?.content).toContain('here is what I found so far');
    // Plus an honest note about why it stopped, naming the budget.
    expect(history.at(-1)?.content).toContain('3-step tool limit');
    // 3 budgeted rounds with tools, then one wrap-up round with none.
    expect(toolRounds).toHaveLength(4);
    expect(toolRounds[2].tools?.length).toBeGreaterThan(0);
    expect(toolRounds[3].tools).toEqual([]);
    // The wrap-up nudge is never persisted into the transcript.
    expect(history.filter((m) => m.role === 'user')).toHaveLength(1);
  });

  it('still notes the step limit when the wrap-up pass produces nothing', async () => {
    const provider: Provider = {
      config: { id: 'p', kind: 'openai-compat', label: 'x', baseUrl: 'x', enabled: true },
      listModels: async () => [],
      test: async () => ({ ok: true, message: '' }),
      async *chat(req: ChatRequest) {
        if (req.tools?.length) yield { type: 'tool_call', call: { id: 'c', name: 'bash', input: {} } } as ProviderChunk;
        yield { type: 'done' } as ProviderChunk;
      },
    };
    const history: ChatMessage[] = [{ id: 'u', role: 'user', content: 'go', createdAt: 0 }];
    const events = [];
    for await (const e of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history, maxIterations: 1,
      executeTool: async (c) => ({ toolCallId: c.id, output: 'ok' }),
    })) {
      events.push(e);
    }
    expect(events.at(-1)?.type).toBe('done');
    expect(history.at(-1)?.content).toContain('1-step tool limit');
  });

  it('sends only the last N user-turn groups when maxHistoryTurns is set', async () => {
    let seen: ChatMessage[] = [];
    const provider: Provider = {
      config: { id: 'p', kind: 'openai-compat', label: 'x', baseUrl: 'x', enabled: true },
      listModels: async () => [],
      test: async () => ({ ok: true, message: '' }),
      async *chat(req: ChatRequest) {
        seen = req.messages;
        yield { type: 'text', delta: 'ok' } as ProviderChunk;
        yield { type: 'done' } as ProviderChunk;
      },
    };
    // Three prior turns (user→assistant) plus a fresh 4th user turn.
    const history: ChatMessage[] = [
      msg('user', 'u1'), msg('assistant', 'a1'),
      msg('user', 'u2'), msg('assistant', 'a2'),
      msg('user', 'u3'), msg('assistant', 'a3'),
      msg('user', 'u4'),
    ];
    for await (const _ of runAgent({
      sessionId: 's', provider, model: 'm', system: 'sys', history, maxHistoryTurns: 2,
      executeTool: async () => ({ toolCallId: 'x', output: '' }),
    })) { /* drain */ }
    // Window keeps the last 2 user groups (u3,a3,u4); the new assistant is
    // appended to the FULL history, which still holds all four turns.
    expect(seen.map((m) => m.content)).toEqual(['u3', 'a3', 'u4']);
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  });
});

describe('windowHistory', () => {
  const h: ChatMessage[] = [
    msg('user', 'u1'), msg('assistant', 'a1'),
    msg('user', 'u2'), msg('assistant', 'a2'), msg('tool', 't2'), msg('assistant', 'a2b'),
    msg('user', 'u3'), msg('assistant', 'a3'),
  ];

  it('returns history unchanged with no limit (normal chats)', () => {
    expect(windowHistory(h, undefined)).toBe(h);
    expect(windowHistory(h, 0)).toBe(h);
  });

  it('returns history unchanged when there are fewer user turns than the limit', () => {
    expect(windowHistory(h, 5)).toBe(h);
    expect(windowHistory(h, 3)).toBe(h);
  });

  it('cuts on a user boundary, keeping complete turn groups', () => {
    // Last 2 user groups: u2 (with its assistant/tool/assistant) and u3.
    expect(windowHistory(h, 2).map((m) => m.content)).toEqual(['u2', 'a2', 't2', 'a2b', 'u3', 'a3']);
    // The window always begins on a user message (never a stranded tool result).
    expect(windowHistory(h, 2)[0].role).toBe('user');
    expect(windowHistory(h, 1).map((m) => m.content)).toEqual(['u3', 'a3']);
  });
});
