import React, { useId } from 'react';

/**
 * The one console block the transcript is built from: a monospace disclosure
 * row (glyph · label · meta) that expands into its detail body. Tool calls,
 * reasoning and grouped working steps all render as this, so every step of an
 * agent turn reads the same way instead of each one styling itself.
 */
export function ConsoleBlock({
  open,
  onToggle,
  glyph,
  label,
  meta,
  labelClassName = 'font-medium',
  headerClassName = 'text-ink-faint hover:text-ink-soft',
  bodyClassName = 'ml-[18px] mt-0.5 border-l border-line pl-2',
  className = 'fade-in mt-1',
  children,
}: {
  open: boolean;
  onToggle: () => void;
  /** Small leading marker (a tool/state glyph), already colored by the caller. */
  glyph?: React.ReactNode;
  label: React.ReactNode;
  /** Trailing muted detail on the header row (tool names, a spinner, …). */
  meta?: React.ReactNode;
  labelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const bodyId = useId();
  return (
    <div className={`font-mono text-[12px] ${className}`}>
      <button
        className={`flex w-full items-center gap-1.5 py-0.5 text-left ${headerClassName}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="w-3 shrink-0 text-[10px]" aria-hidden>{open ? '▾' : '▸'}</span>
        {glyph}
        <span className={labelClassName}>{label}</span>
        {meta}
      </button>
      {open && children != null && <div id={bodyId} className={bodyClassName}>{children}</div>}
    </div>
  );
}
