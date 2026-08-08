import { describe, expect, it } from 'vitest';
import { approvalPolicy, runChat, type Client } from './lib.js';
import { EXIT_CODES, parseFlags } from './run.js';

function fakeClient(events: any[] = []) {
  let listener: ((event: any) => void) | undefined;
  const approvals: boolean[] = [];
  const client = {
    ready: async () => {},
    setSessionOptions: async () => {},
    onAgentEvent: (cb: (event: any) => void) => {
      listener = cb;
      return () => { listener = undefined; };
    },
    sendChat: async () => {
      for (const event of events) queueMicrotask(() => listener?.(event));
    },
    approveTool: async (_session: string, _id: string, approved: boolean) => { approvals.push(approved); },
    abortChat: async () => {},
  } as unknown as Client;
  return { client, approvals };
}

describe('CLI policy and flag parsing', () => {
  it('parses flags without consuming positional prompts', () => {
    expect(parseFlags(['chat', 'hello world', '--approve', 'guardrails', '--json'])).toEqual({
      _: ['chat', 'hello world'],
      flags: { approve: 'guardrails', json: true },
    });
  });

  it('defaults approval to guardrails and validates explicit modes', () => {
    expect(approvalPolicy(undefined)).toBe('guardrails');
    expect(approvalPolicy('yolo')).toBe('yolo');
    expect(() => approvalPolicy('unsafe')).toThrow();
  });

  it('records blocked approvals and emits typed events without approving them', async () => {
    const events: any[] = [];
    const { client, approvals } = fakeClient([
      { type: 'tool_call', sessionId: 's', call: { id: 'c', name: 'run', input: { command: 'rm -rf x' } } },
      { type: 'tool_approval_required', sessionId: 's', call: { id: 'c', name: 'run', input: { command: 'rm -rf x' } }, reason: 'destructive', severity: 'high' },
      { type: 'tool_result', sessionId: 's', result: { toolCallId: 'c', output: 'blocked', isError: true } },
      { type: 'text', sessionId: 's', delta: 'done' },
      { type: 'done', sessionId: 's', messageId: 'm' },
    ]);
    const result = await runChat(client, { sessionId: 's', providerId: 'p', modelId: 'm', text: 'x', onEvent: (event) => events.push(event) });
    expect(result.text).toBe('done');
    expect(result.blocked[0]).toMatchObject({ command: 'rm -rf x', severity: 'high', ruleLabels: ['destructive'] });
    expect(approvals).toEqual([false]);
    expect(events.map((e) => e.type)).toEqual(['tool_call', 'blocked', 'tool_result', 'text', 'done']);
    expect(result.toolCalls[0]).toMatchObject({ name: 'run', ok: false, error: 'blocked' });
    expect(EXIT_CODES.blocked).toBe(4);
  });
});
