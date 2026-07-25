import type { ChatMessage, ToolCall } from '@kotrain/shared';

/**
 * Pure transcript model for the agent console: how a raw message list folds
 * into the blocks the console renders (tool calls, reasoning, narration, the
 * final answer).
 */

/** One step of an assistant turn: a tool call, a reasoning block, or a bit of
 *  narration text between tools. Grouped into a single collapsible section. */
export type Activity =
  | { kind: 'tool'; call: ToolCall }
  | { kind: 'reasoning'; text: string; duration: number | null }
  | { kind: 'note'; text: string };

/** A render block of the transcript: a message bubble (user or the final
 *  assistant answer) or a grouped run of the model's working steps. */
export type StreamBlock =
  | { type: 'msg'; message: ChatMessage }
  | { type: 'activity'; key: string; items: Activity[] };

/**
 * Fold a transcript into render blocks, collapsing each run of the model's
 * working steps (reasoning, tool calls, and inter-tool narration) into one
 * activity group so a many-step turn reads as a single expandable line instead
 * of a wall of "Used <tool>" rows. Only the final answer stays a bubble.
 */
export function toStreamBlocks(messages: ChatMessage[]): StreamBlock[] {
  const blocks: StreamBlock[] = [];
  let run: Activity[] = [];
  let runKey = '';
  const flush = () => {
    if (run.length) { blocks.push({ type: 'activity', key: `act_${runKey}`, items: run }); run = []; }
  };
  messages.forEach((m, i) => {
    if (m.role === 'tool') return;
    if (m.role === 'user') { flush(); blocks.push({ type: 'msg', message: m }); return; }
    // Assistant messages that still call tools are working steps; the one that
    // stops calling tools is the answer.
    if (m.toolCalls?.length) {
      if (!run.length) runKey = `${m.id}_${i}`;
      if (m.reasoning) run.push({ kind: 'reasoning', text: m.reasoning, duration: m.reasoningSeconds ?? null });
      if (m.content.trim()) run.push({ kind: 'note', text: m.content });
      m.toolCalls.forEach((c) => run.push({ kind: 'tool', call: c }));
    } else {
      flush();
      blocks.push({ type: 'msg', message: m });
    }
  });
  flush();
  return blocks;
}

/** "1.2k" / "18k" / "640" — compact token counts for the console footer. */
export const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

/** Short local time for a message timestamp (e.g. "3:42 PM"). */
export function fmtTime(ts: number): string {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}
