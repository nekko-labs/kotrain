/**
 * The agent console: the blocks an agent transcript is made of — tool calls
 * (with diffs), reasoning, grouped working steps, message turns, the guardrail
 * approval bar, and the token/effort footer. `ChatPane` composes these; nothing
 * here knows about sessions or IPC.
 */
export { ActivityGroup } from './ActivityGroup.js';
export { ApprovalBar, type PendingApproval } from './ApprovalBar.js';
export { ConsoleBlock } from './ConsoleBlock.js';
export { MessageBubble } from './MessageBubble.js';
export { ReasoningBlock } from './ReasoningBlock.js';
export { ToolCallBlock } from './ToolCallBlock.js';
export { TurnFooter } from './TurnFooter.js';
export { fmtTime, fmtTok, toStreamBlocks, type Activity, type StreamBlock } from './transcript.js';
