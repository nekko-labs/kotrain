import type { AgentEvent, ChatMessage, ToolCall, ToolResult } from '@kotrain/shared';
import type { Provider, ToolSpec } from '../providers/types.js';
import { BUILTIN_TOOLS } from './tools.js';

export interface RunAgentOptions {
  sessionId: string;
  provider: Provider;
  model: string;
  system: string;
  /** Conversation so far (excluding system). New messages are appended in place. */
  history: ChatMessage[];
  tools?: ToolSpec[];
  /** Executes a tool call in the host and returns its result. */
  executeTool: (call: ToolCall) => Promise<ToolResult>;
  signal?: AbortSignal;
  /** Max tool-use round trips before giving up. */
  maxIterations?: number;
  /** Sampling temperature (from the effort setting). */
  temperature?: number;
  /** Reasoning toggle passed to the provider (true/false/undefined = default). */
  think?: boolean;
  /**
   * When set, only the last N user-turn groups of `history` are sent to the
   * model (new messages are still appended to the full `history` array so the
   * caller persists the whole transcript). Cutting on user-message boundaries
   * keeps tool_use/tool_result pairs intact. Used by long-running run-driven
   * loops so they don't replay an ever-growing transcript every turn.
   */
  maxHistoryTurns?: number;
}

let counter = 0;
function id(prefix: string): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

/**
 * Window `history` to the last `turns` user-turn groups for sending to the
 * model. Cuts on a user-message boundary so the window always starts on a user
 * message and never splits a tool_use from its tool_result. Returns `history`
 * unchanged when `turns` is falsy or there are no more than `turns` user
 * messages, so normal chats (no limit) are unaffected.
 */
export function windowHistory(history: ChatMessage[], turns?: number): ChatMessage[] {
  if (!turns || turns < 1) return history;
  const userIdx: number[] = [];
  for (let i = 0; i < history.length; i++) if (history[i].role === 'user') userIdx.push(i);
  if (userIdx.length <= turns) return history;
  return history.slice(userIdx[userIdx.length - turns]);
}

/**
 * The agentic loop: stream a model response, run any tool calls, feed the
 * results back, and repeat until the model stops calling tools. Yields
 * normalized AgentEvents that the host forwards to the renderer.
 *
 * History is mutated to include the assistant + tool messages so callers can
 * persist the full transcript.
 */
/** What one streamed provider response accumulated. */
interface Turn {
  text: string;
  reasoning: string;
  reasoningSeconds?: number;
  calls: ToolCall[];
}

/** A response that produced no text, no reasoning, and no tool calls. Some local
 *  models occasionally stop cold mid-agent-loop (finish_reason "stop" with a
 *  single token); treating that as a completed turn makes the chat look like it
 *  silently died. We detect it so the loop can retry once with a nudge. */
function isEmptyTurn(t: Turn): boolean {
  return !t.text.trim() && !t.reasoning.trim() && t.calls.length === 0;
}

export async function* runAgent(opts: RunAgentOptions): AsyncGenerator<AgentEvent> {
  const tools = opts.tools ?? BUILTIN_TOOLS;
  const maxIterations = opts.maxIterations ?? 12;

  // Stream one provider response, yielding its events and accumulating the
  // result into `turn`. `extraMessages` are appended to the sent history only
  // (never persisted) so a retry can nudge the model without polluting the
  // transcript.
  async function* stream(turn: Turn, extraMessages: ChatMessage[] = []): AsyncGenerator<AgentEvent> {
    let reasoningStartedAt = 0;
    for await (const chunk of opts.provider.chat({
      model: opts.model,
      messages: [...windowHistory(opts.history, opts.maxHistoryTurns), ...extraMessages],
      system: opts.system,
      tools,
      temperature: opts.temperature,
      think: opts.think,
      signal: opts.signal,
    })) {
      switch (chunk.type) {
        case 'text':
          if (reasoningStartedAt && turn.reasoningSeconds == null) {
            turn.reasoningSeconds = Math.round((Date.now() - reasoningStartedAt) / 1000);
          }
          turn.text += chunk.delta;
          yield { type: 'text', sessionId: opts.sessionId, delta: chunk.delta };
          break;
        case 'reasoning':
          if (!reasoningStartedAt) reasoningStartedAt = Date.now();
          turn.reasoning += chunk.delta;
          yield { type: 'reasoning', sessionId: opts.sessionId, delta: chunk.delta };
          break;
        case 'tool_call':
          if (reasoningStartedAt && turn.reasoningSeconds == null) {
            turn.reasoningSeconds = Math.round((Date.now() - reasoningStartedAt) / 1000);
          }
          turn.calls.push(chunk.call);
          yield { type: 'tool_call', sessionId: opts.sessionId, call: chunk.call };
          break;
        case 'usage':
          yield {
            type: 'usage',
            sessionId: opts.sessionId,
            inputTokens: chunk.inputTokens,
            outputTokens: chunk.outputTokens,
          };
          break;
        case 'done':
          break;
      }
    }
    if (reasoningStartedAt && turn.reasoningSeconds == null) {
      turn.reasoningSeconds = Math.round((Date.now() - reasoningStartedAt) / 1000);
    }
  }

  // A transient nudge used to recover from an empty response (not persisted).
  const nudge: ChatMessage = {
    id: id('nudge'),
    role: 'user',
    content: 'Please continue and give your answer.',
    createdAt: Date.now(),
  };

  for (let iter = 0; iter < maxIterations; iter++) {
    if (opts.signal?.aborted) {
      yield { type: 'error', sessionId: opts.sessionId, message: 'Aborted' };
      return;
    }

    const turn: Turn = { text: '', reasoning: '', calls: [] };
    try {
      yield* stream(turn);
      // Empty response: retry once with a nudge before giving up so the turn
      // doesn't silently stall (common with some local models mid-loop).
      if (isEmptyTurn(turn) && !opts.signal?.aborted) {
        yield* stream(turn, [nudge]);
      }
    } catch (e) {
      yield { type: 'error', sessionId: opts.sessionId, message: (e as Error).message };
      return;
    }

    const { text, reasoning, reasoningSeconds, calls } = turn;

    // Still nothing after the retry: surface it instead of ending on a blank
    // bubble, so the user knows the turn ended and can try again.
    const stalled = isEmptyTurn(turn);
    const content = stalled
      ? '_The model returned an empty response and stopped. It may have run out of steam — try again, or rephrase._'
      : text;

    // Record the assistant message.
    const assistantMsg: ChatMessage = {
      id: id('msg'),
      role: 'assistant',
      content,
      ...(reasoning ? { reasoning, reasoningSeconds } : {}),
      toolCalls: calls.length ? calls : undefined,
      createdAt: Date.now(),
    };
    opts.history.push(assistantMsg);

    // No tool calls → the turn is complete.
    if (calls.length === 0) {
      yield { type: 'done', sessionId: opts.sessionId, messageId: assistantMsg.id };
      return;
    }

    // Execute tool calls sequentially (the host applies guardrails/approval).
    for (const call of calls) {
      let result: ToolResult;
      try {
        result = await opts.executeTool(call);
      } catch (e) {
        result = { toolCallId: call.id, output: `Error: ${(e as Error).message}`, isError: true };
      }
      opts.history.push({
        id: id('msg'),
        role: 'tool',
        content: '',
        toolResult: result,
        createdAt: Date.now(),
      });
      yield { type: 'tool_result', sessionId: opts.sessionId, result };
    }
  }

  yield { type: 'error', sessionId: opts.sessionId, message: 'Reached max tool iterations' };
}
