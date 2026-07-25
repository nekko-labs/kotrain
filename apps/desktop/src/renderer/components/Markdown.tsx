import React, { useState } from 'react';

/**
 * Minimal, dependency-free markdown renderer covering the constructs chat
 * models actually emit: fenced code blocks, inline code, bold, headings,
 * bullet lists, and pipe tables. Kept intentionally small; not a full
 * CommonMark implementation.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const parts = text.split(/```/);

  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf('\n');
      const lang = nl > 0 ? part.slice(0, nl).trim() : '';
      const code = nl > 0 ? part.slice(nl + 1) : part;
      blocks.push(<CodeBlock key={`code-${i}`} lang={lang} code={code.replace(/\n$/, '')} />);
    } else {
      part.split('\n\n').forEach((para, j) => {
        if (!para.trim()) return;
        blocks.push(<div key={`p-${i}-${j}`}>{renderParagraph(para)}</div>);
      });
    }
  });

  return <div className="space-y-1 text-[14px] leading-relaxed">{blocks}</div>;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="group relative my-2">
      <pre
        className="overflow-x-auto rounded-xl border border-line p-3 font-mono text-[13px] leading-relaxed"
        style={{ background: 'var(--surface-2)' }}
      >
        {lang && <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">{lang}</div>}
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        title="Copy code"
        className="absolute right-2 top-2 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        style={{ background: 'var(--surface)' }}
      >
        {copied ? '✓ copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Split a markdown table row into trimmed cells (drops the outer pipes). */
function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function renderParagraph(para: string): React.ReactNode {
  const lines = para.split('\n');

  // Pipe table: a header row, a |---|---| separator, then body rows. Wrapped
  // in its own horizontal scroller so a wide table never stretches the thread.
  const isTable =
    lines.length >= 2 &&
    lines.every((l) => l.trim().startsWith('|') || !l.trim()) &&
    /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[1] ?? '') &&
    lines[1].includes('-');
  if (isTable) {
    const header = tableCells(lines[0]);
    const body = lines.slice(2).filter((l) => l.trim()).map(tableCells);
    return (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {header.map((h, k) => (
                <th key={k} className="border-b border-line px-2.5 py-1.5 text-left font-semibold">{inline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>
                {header.map((_, c) => (
                  <td key={c} className="border-b border-line px-2.5 py-1.5 align-top text-ink-soft">{inline(row[c] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Unordered list.
  const isBullet = lines.every((l) => /^\s*[-*]\s+/.test(l) || !l.trim());
  if (isBullet && lines.some((l) => /^\s*[-*]\s+/.test(l))) {
    return (
      <ul className="ml-4 list-disc space-y-0.5">
        {lines.filter((l) => l.trim()).map((l, k) => (
          <li key={k}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>
        ))}
      </ul>
    );
  }

  // Ordered list.
  const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l) || !l.trim());
  if (isOrdered && lines.some((l) => /^\s*\d+\.\s+/.test(l))) {
    return (
      <ol className="ml-5 list-decimal space-y-0.5">
        {lines.filter((l) => l.trim()).map((l, k) => (
          <li key={k}>{inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    );
  }

  const heading = /^(#{1,4})\s+(.*)$/.exec(para);
  if (heading) {
    const level = heading[1].length;
    return <div className={`font-semibold ${level <= 2 ? 'text-[15px]' : ''}`}>{inline(heading[2])}</div>;
  }
  return <p>{inline(para)}</p>;
}

function inline(s: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  // bold | inline code | [text](url) link
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <code key={key++} className="rounded px-1 py-0.5 font-mono text-[13px]" style={{ background: 'var(--surface-2)' }}>
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined) {
      // target=_blank routes through Electron's setWindowOpenHandler → opens externally.
      nodes.push(
        <a key={key++} href={m[5]} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--accent)' }}>
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}
