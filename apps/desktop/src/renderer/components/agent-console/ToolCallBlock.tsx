import React, { useState } from 'react';
import type { ToolCall } from '@kotrain/shared';
import { ConsoleBlock } from './ConsoleBlock.js';

/** Edits carry the before/after text, so the console can show them as a diff
 *  instead of a wall of escaped JSON. */
function editDiff(call: ToolCall): { path?: string; removed: string; added: string } | null {
  const input = call.input as Record<string, unknown>;
  const path = typeof input.path === 'string' ? input.path : undefined;
  if (call.name === 'edit_file' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    return { path, removed: input.old_string, added: input.new_string };
  }
  if (call.name === 'write_file' && typeof input.content === 'string') {
    return { path, removed: '', added: input.content };
  }
  return null;
}

function DiffLines({ text, sign }: { text: string; sign: '+' | '-' }) {
  if (!text) return null;
  const color = sign === '+' ? 'var(--success)' : 'var(--danger)';
  const tint = sign === '+' ? 'var(--success-soft)' : 'var(--danger-soft)';
  return (
    <>
      {text.split('\n').map((line, i) => (
        <div key={`${sign}${i}`} className="flex" style={{ background: tint }}>
          <span className="w-4 shrink-0 select-none text-center" style={{ color }} aria-hidden>{sign}</span>
          <span className="whitespace-pre-wrap break-words" style={{ color }}>{line || ' '}</span>
        </div>
      ))}
    </>
  );
}

/** The expanded detail of a tool call: a diff for edits, the raw input otherwise. */
function ToolCallDetail({ call }: { call: ToolCall }) {
  const diff = editDiff(call);
  if (!diff) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap text-ink-faint">{JSON.stringify(call.input, null, 2)}</pre>
    );
  }
  return (
    <div className="overflow-x-auto">
      {diff.path && <div className="truncate text-[11px] text-ink-faint">{diff.path}</div>}
      <DiffLines text={diff.removed} sign="-" />
      <DiffLines text={diff.added} sign="+" />
    </div>
  );
}

/** One tool call in the transcript: what ran, expandable to its input/diff. */
export function ToolCallBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const isSpawn = call.name === 'spawn_agent';
  const isScript = call.name === 'bash';
  return (
    <ConsoleBlock
      open={open}
      onToggle={() => setOpen((value) => !value)}
      className="mt-1"
      headerClassName={`${isScript ? 'text-danger' : 'text-success'} hover:text-ink-soft`}
      label={<>{isSpawn ? '🤖 ' : ''}Used <span className="font-mono">{call.name}</span> tool</>}
      bodyClassName="ml-[18px] mt-0.5 border-l border-line pl-2"
    >
      <ToolCallDetail call={call} />
    </ConsoleBlock>
  );
}
