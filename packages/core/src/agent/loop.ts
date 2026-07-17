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
}

let counter = 0;
function id(prefix: string): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

/**
 * The agentic loop: stream a model response, run any tool calls, feed the
 * results back, and repeat until the model stops calling tools. Yields
 * normalized AgentEvents that the host forwards to the renderer.
 *
 * History is mutated to include the assistant + tool messages so callers can
 * persist the full transcript.
 */
export async function* runAgent(opts: RunAgentOptions): AsyncGenerator<AgentEvent> {
  const tools = opts.tools ?? BUILTIN_TOOLS;
  const maxIterations = opts.maxIterations ?? 12;

  for (let iter = 0; iter < maxIterations; iter++) {
    if (opts.signal?.aborted) {
      yield { type: 'error', sessionId: opts.sessionId, message: 'Aborted' };
      return;
    }

    let text = '';
    let reasoning = '';
    let reasoningStartedAt = 0;
    let reasoningSeconds: number | undefined;
    const calls: ToolCall[] = [];

    try {
      for await (const chunk of opts.provider.chat({
        model: opts.model,
        messages: opts.history,
        system: opts.system,
        tools,
        temperature: opts.temperature,
        signal: opts.signal,
      })) {
        switch (chunk.type) {
          case 'text':
            if (reasoningStartedAt && reasoningSeconds == null) {
              reasoningSeconds = Math.round((Date.now() - reasoningStartedAt) / 1000);
            }
            text += chunk.delta;
            yield { type: 'text', sessionId: opts.sessionId, delta: chunk.delta };
            break;
          case 'reasoning':
            if (!reasoningStartedAt) reasoningStartedAt = Date.now();
            reasoning += chunk.delta;
            yield { type: 'reasoning', sessionId: opts.sessionId, delta: chunk.delta };
            break;
          case 'tool_call':
            if (reasoningStartedAt && reasoningSeconds == null) {
              reasoningSeconds = Math.round((Date.now() - reasoningStartedAt) / 1000);
            }
            calls.push(chunk.call);
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
    } catch (e) {
      yield { type: 'error', sessionId: opts.sessionId, message: (e as Error).message };
      return;
    }

    if (reasoningStartedAt && reasoningSeconds == null) {
      reasoningSeconds = Math.round((Date.now() - reasoningStartedAt) / 1000);
    }

    // Record the assistant message.
    const assistantMsg: ChatMessage = {
      id: id('msg'),
      role: 'assistant',
      content: text,
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
