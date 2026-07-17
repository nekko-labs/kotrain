import React, { useMemo, useState } from 'react';
import { analyzePrompt, GRADE_COLOR, SEVERITY_COLOR, type Finding, type Severity } from '../promptAnalysis.js';

/**
 * Live prompt analyzer in the composer. Zero-latency, client-side: shows a health
 * grade, which parts of a good prompt are present/missing, inline-underlined weak
 * spots, concrete suggestions, and a model recommendation. A marketing edge -
 * "Kotrain helps you write the prompt," not just answer it.
 */
const SEV_ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };

export function PromptAnalyzer({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const a = useMemo(() => analyzePrompt(text), [text]);
  if (text.trim().length < 12) return null;

  const present = a.parts.filter((p) => p.present).length;
  const issues = a.findings.length;
  const ranged = a.findings.some((f) => f.start != null);

  return (
    <div className="mx-auto mb-2 w-full max-w-3xl">
      <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1 text-[11px]" style={{ background: 'var(--surface-2)' }}>
        <GradeBadge grade={a.grade} />
        <button onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-2 text-left text-ink-soft">
          <span>{present}/{a.parts.length} parts</span>
          <span className="text-ink-faint">·</span>
          <span>{issues === 0 ? 'looks good' : `${issues} suggestion${issues === 1 ? '' : 's'}`}</span>
          <span className="ml-auto chip text-[9px] uppercase" title={a.model.reason}>{a.model.tier} model</span>
          <span className="text-ink-faint">{open ? '▾' : '▸'}</span>
        </button>
      </div>

      {open && (
        <div className="mt-1 space-y-2 rounded-lg border border-line p-2.5 text-[11.5px]" style={{ background: 'var(--surface)' }}>
          <div className="flex flex-wrap gap-1">
            {a.parts.map((p) => (
              <span
                key={p.id}
                title={p.hint}
                className="cursor-help rounded-full border px-2 py-0.5 text-[10.5px]"
                style={p.present ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : { borderColor: 'var(--line)', color: 'var(--ink-faint)' }}
              >
                {p.present ? '✓' : '+'} {p.label}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-ink-faint">
            <span className="font-medium text-ink-soft">Suggested model:</span> {a.model.reason}
          </p>

          {a.findings.length > 0 ? (
            <ul className="space-y-1">
              {[...a.findings].sort((x, y) => SEV_ORDER[x.severity] - SEV_ORDER[y.severity]).map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[f.severity] }} />
                  <span className="text-ink-soft">{f.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-faint">Clear task and structure, nothing to flag.</p>
          )}

          {ranged && (
            <div className="rounded-lg border border-line p-2 font-mono text-[11px] leading-relaxed" style={{ background: 'var(--surface-2)' }}>
              <Annotated text={text} findings={a.findings} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' | 'D' | 'F' }) {
  return (
    <span
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
      style={{ background: GRADE_COLOR[grade] }}
      title={`Prompt health: ${grade}`}
    >
      {grade}
    </span>
  );
}

/** Render the prompt with flagged spans wavy-underlined by severity. */
function Annotated({ text, findings }: { text: string; findings: Finding[] }) {
  const ranges = findings
    .filter((f) => f.start != null && f.end != null)
    .map((f) => ({ start: f.start!, end: f.end!, sev: f.severity }))
    .sort((x, y) => x.start - y.start);

  const segs: React.ReactNode[] = [];
  let pos = 0;
  let key = 0;
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start < lastEnd) continue; // skip overlaps
    if (r.start > pos) segs.push(text.slice(pos, r.start));
    segs.push(
      <span
        key={key++}
        style={{ textDecoration: 'underline', textDecorationStyle: 'wavy', textDecorationColor: SEVERITY_COLOR[r.sev], textUnderlineOffset: 2 }}
      >
        {text.slice(r.start, r.end)}
      </span>,
    );
    pos = r.end;
    lastEnd = r.end;
  }
  if (pos < text.length) segs.push(text.slice(pos));
  return <span className="whitespace-pre-wrap break-words text-ink-soft">{segs}</span>;
}
