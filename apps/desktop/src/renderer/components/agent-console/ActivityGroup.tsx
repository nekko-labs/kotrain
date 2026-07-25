import React, { useState } from 'react';
import { Markdown } from '../Markdown.js';
import { ConsoleBlock } from './ConsoleBlock.js';
import { ReasoningBlock } from './ReasoningBlock.js';
import { ToolCallBlock } from './ToolCallBlock.js';
import type { Activity } from './transcript.js';

/**
 * A collapsed, expandable summary of a run of the model's working steps. Reads
 * as one line ("Worked on 6 steps · read_file, grep") that expands to the
 * individual tool calls, reasoning, and narration.
 */
export function ActivityGroup({ items, streaming = false }: { items: Activity[]; streaming?: boolean }) {
  const [open, setOpen] = useState(false);
  const tools = items.filter((it): it is Extract<Activity, { kind: 'tool' }> => it.kind === 'tool');
  const toolCount = tools.length;
  const hasScript = tools.some((t) => t.call.name === 'bash');
  const names = Array.from(new Set(tools.map((t) => t.call.name)));
  const summary = streaming
    ? (toolCount ? `Working · ${tools[tools.length - 1].call.name}` : 'Thinking')
    : (toolCount ? `Worked on ${toolCount} step${toolCount === 1 ? '' : 's'}` : 'Thought it through');
  return (
    <ConsoleBlock
      open={open}
      onToggle={() => setOpen((o) => !o)}
      glyph={<span className={`shrink-0 ${hasScript ? 'text-danger' : 'text-success'}`} aria-hidden>⚒</span>}
      label={summary}
      labelClassName="font-medium text-ink-soft"
      meta={
        <>
          {!streaming && names.length > 0 && <span className="min-w-0 truncate text-ink-faint">· {names.join(', ')}</span>}
          {streaming && <span className="dots" />}
        </>
      }
      bodyClassName="ml-[7px] mt-0.5 space-y-0.5 border-l border-line pl-2.5"
    >
      {items.map((it, i) => {
        if (it.kind === 'tool') return <ToolCallBlock key={`${it.call.id}_${i}`} call={it.call} />;
        if (it.kind === 'reasoning') return <ReasoningBlock key={`r${i}`} text={it.text} live={false} duration={it.duration} />;
        return (
          <div key={`n${i}`} className="py-0.5 font-sans text-[12.5px] text-ink-soft">
            <Markdown text={it.text} />
          </div>
        );
      })}
    </ConsoleBlock>
  );
}
