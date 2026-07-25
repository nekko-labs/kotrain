import React, { useEffect, useState } from 'react';
import { ConsoleBlock } from './ConsoleBlock.js';

/** The model's thinking for a turn: collapsed to one line, expandable to the
 *  full reasoning text. Collapses itself again once the turn stops streaming. */
export function ReasoningBlock({ text, live, duration }: { text: string; live: boolean; duration: number | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!live) setOpen(false); }, [live]);
  return (
    <ConsoleBlock
      open={open}
      onToggle={() => setOpen((o) => !o)}
      label={`💭 ${live ? 'Thinking…' : duration != null ? `Thought for ${duration}s` : 'Thought process'}`}
      labelClassName=""
      bodyClassName=""
    >
      <pre className="ml-[18px] mt-0.5 max-h-60 overflow-y-auto whitespace-pre-wrap border-l border-line pl-2 text-[12px] font-mono leading-relaxed text-ink-faint">{text}</pre>
    </ConsoleBlock>
  );
}
