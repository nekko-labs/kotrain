import React, { useState } from 'react';

/**
 * Minimal, dependency-free markdown renderer covering the constructs a chat
 * actually contains: fenced code blocks, headings, bullet and numbered lists
 * (nested), pipe tables, block quotes, rules, and inline bold / italic /
 * strikethrough / code / links. Kept intentionally small; not a full CommonMark
 * implementation.
 *
 * Blocks are found by scanning lines rather than by splitting on blank lines, so
 * a run of dashes glued to the sentence above it still becomes a real list, the
 * way it does in every other chat surface. Single newlines inside a paragraph
 * are kept as line breaks, since people write chat messages that way.
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
      blocks.push(...renderBlocks(part, `b${i}`));
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

const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)\d+[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_DIVIDER_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/** Split a markdown table row into trimmed cells (drops the outer pipes). */
function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

interface ListItem {
  indent: number;
  text: string;
  ordered: boolean;
}

function listItem(line: string): ListItem | null {
  const bullet = BULLET_RE.exec(line);
  if (bullet) return { indent: bullet[1].length, text: bullet[2], ordered: false };
  const ordered = ORDERED_RE.exec(line);
  if (ordered) return { indent: ordered[1].length, text: ordered[2], ordered: true };
  return null;
}

/** True for any line that starts a block of its own, so a paragraph run stops. */
function startsBlock(line: string): boolean {
  return !line.trim() || !!listItem(line) || HEADING_RE.test(line) || QUOTE_RE.test(line) || RULE_RE.test(line);
}

/**
 * One flat run of list items folded into a nested list: items more indented than
 * the run's first item become children of the item above them.
 */
function renderList(items: ListItem[], key: string, depth = 0): React.ReactNode {
  const base = items[0].indent;
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < items.length) {
    // Everything more indented than the base level belongs to this item.
    let end = i + 1;
    while (end < items.length && items[end].indent > base) end += 1;
    const children = items.slice(i + 1, end);
    nodes.push(
      <li key={`${key}-${i}`}>
        {inline(items[i].text)}
        {children.length > 0 && renderList(children, `${key}-${i}s`, depth + 1)}
      </li>,
    );
    i = end;
  }
  const className = 'ml-4 space-y-0.5';
  return items[0].ordered
    ? <ol key={key} className={className} style={{ listStyleType: depth % 2 ? 'lower-alpha' : 'decimal', paddingLeft: '0.35rem' }}>{nodes}</ol>
    : <ul key={key} className={className} style={{ listStyleType: depth % 2 ? 'circle' : 'disc', paddingLeft: '0.35rem' }}>{nodes}</ul>;
}

/**
 * Scan a (fence-free) chunk of markdown into block-level nodes. Each branch
 * consumes the lines it owns and leaves `i` on the first line it doesn't.
 */
function renderBlocks(src: string, key: string): React.ReactNode[] {
  const lines = src.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i += 1; continue; }

    // Pipe table: a header row, a |---|---| divider, then body rows.
    if (line.trim().startsWith('|') && TABLE_DIVIDER_RE.test(lines[i + 1] ?? '')) {
      const header = tableCells(line);
      const body: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) { body.push(tableCells(lines[j])); j += 1; }
      out.push(
        <div key={`${key}-t${i}`} className="my-2 overflow-x-auto">
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
        </div>,
      );
      i = j;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(
        <div key={`${key}-h${i}`} className={`font-semibold ${level <= 2 ? 'mt-1 text-[15px]' : ''}`}>
          {inline(heading[2])}
        </div>,
      );
      i += 1;
      continue;
    }

    if (RULE_RE.test(line)) {
      out.push(<hr key={`${key}-r${i}`} className="my-2 border-line" />);
      i += 1;
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      const quoted: string[] = [];
      let j = i;
      while (j < lines.length) {
        const q = QUOTE_RE.exec(lines[j]);
        if (!q) break;
        quoted.push(q[1]);
        j += 1;
      }
      out.push(
        <blockquote key={`${key}-q${i}`} className="my-1 border-l-2 border-line pl-2.5 text-ink-soft">
          {renderBlocks(quoted.join('\n'), `${key}-q${i}i`)}
        </blockquote>,
      );
      i = j;
      continue;
    }

    const first = listItem(line);
    if (first) {
      const items: ListItem[] = [];
      let j = i;
      while (j < lines.length) {
        const it = listItem(lines[j]);
        // A same-level switch between bullets and numbers starts a new list.
        if (!it || (it.indent <= first.indent && it.ordered !== first.ordered)) break;
        items.push(it);
        j += 1;
      }
      out.push(renderList(items, `${key}-l${i}`));
      i = j;
      continue;
    }

    // Paragraph: every line up to the next blank line or block start, with the
    // single newlines between them preserved as line breaks.
    const para: string[] = [line];
    let j = i + 1;
    while (j < lines.length && !startsBlock(lines[j])) { para.push(lines[j]); j += 1; }
    out.push(<p key={`${key}-p${i}`}>{lineBreaks(para)}</p>);
    i = j;
  }

  return out;
}

/** Render a paragraph's lines with <br/> between them. */
function lineBreaks(lines: string[]): React.ReactNode {
  return lines.map((l, k) => (
    <React.Fragment key={k}>
      {k > 0 && <br />}
      {inline(l)}
    </React.Fragment>
  ));
}

// bold | italic | strikethrough | inline code | [text](url) link | bare url.
// Italic deliberately covers only *stars*, not _underscores_, so snake_case
// identifiers in prose survive intact; both delimiters must hug their text so
// arithmetic like `2 * 3 * 4` isn't read as emphasis.
const INLINE_RE =
  /(\*\*([^*]+)\*\*|\*([^\s*][^*]*?)\*|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"')\]]+))/g;

function inline(s: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(s))) {
    if (m.index > last) nodes.push(s.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={key++}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      nodes.push(<s key={key++} className="text-ink-faint">{m[4]}</s>);
    } else if (m[5] !== undefined) {
      nodes.push(
        <code key={key++} className="rounded px-1 py-0.5 font-mono text-[13px]" style={{ background: 'var(--surface-2)' }}>
          {m[5]}
        </code>,
      );
    } else if (m[6] !== undefined) {
      // target=_blank routes through Electron's setWindowOpenHandler → opens externally.
      nodes.push(<Link key={key++} href={m[7]}>{m[6]}</Link>);
    } else if (m[8] !== undefined) {
      nodes.push(<Link key={key++} href={m[8]}>{m[8]}</Link>);
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) nodes.push(s.slice(last));
  return nodes;
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-words underline" style={{ color: 'var(--accent)' }}>
      {children}
    </a>
  );
}
