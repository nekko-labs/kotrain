import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LineComment } from '@kotrain/shared';
import { Markdown } from './Markdown.js';
import { FileTypeIcon } from '../fileIcons.js';
import { ExternalIcon, CloseIcon } from '../icons.js';
import { useStore } from '../store.js';

/** Fixed editor line height (px) so the comment gutter aligns row-for-row. */
const LINE_H = 20;

/** Format a line comment into a block the agent reads as a user turn. */
function commentBlock(name: string, line: number, lineText: string, comment: string): string {
  const code = lineText.trim() ? `\n\n\`\`\`\n${lineText}\n\`\`\`` : '';
  return `Re \`${name}:${line}\`, ${comment}${code}`;
}

/**
 * Built-in file viewer/editor. Markdown renders (with a Source/Preview toggle);
 * other text files open in a lightweight mono editor you can edit and save
 * in-app. A gutter "+" lets you drop an inline comment on any line that the
 * agent picks up, Add to prompt (queue it) or Run now (send it). Deliberately
 * not a full IDE, just enough to read, tweak, and steer changes without leaving
 * Kotrain.
 */
export function FilePane({ path }: { path: string }) {
  const isMd = /\.(md|markdown)$/i.test(path);
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
  const sendToChat = useStore((s) => s.sendToChat);

  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [binary, setBinary] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(isMd); // markdown defaults to rendered
  const [comments, setComments] = useState<LineComment[]>([]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    setActiveLine(null);
    window.nekko.readFile(path).then((f) => {
      if (!live) return;
      setContent(f.content);
      setBinary(f.binary);
      setTruncated(f.truncated);
      setDirty(false);
      setLoaded(true);
    }).catch(() => { if (live) { setLoaded(true); setBinary(false); } });
    window.nekko.listComments(path).then((c) => { if (live) setComments(c); }).catch(() => {});
    return () => { live = false; };
  }, [path]);

  const lines = useMemo(() => content.split('\n'), [content]);
  const byLine = useMemo(() => {
    const m = new Map<number, LineComment[]>();
    for (const c of comments) m.set(c.line, [...(m.get(c.line) ?? []), c]);
    return m;
  }, [comments]);

  const save = async () => {
    if (!dirty || truncated) return;
    setSaving(true);
    try {
      await window.nekko.writeFile(path, content);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  };

  const reloadComments = () => window.nekko.listComments(path).then(setComments).catch(() => {});

  // Persist a new comment on the active line, then optionally route it to a chat.
  const addComment = async (text: string, action: 'save' | 'prompt' | 'run') => {
    if (activeLine == null || !text.trim()) return;
    const lineText = lines[activeLine - 1] ?? '';
    await window.nekko.addComment(path, activeLine, lineText, text.trim());
    await reloadComments();
    if (action !== 'save') await sendToChat(commentBlock(name, activeLine, lineText, text.trim()), action === 'run');
  };

  const resolveComment = async (id: string) => {
    await window.nekko.resolveComment(path, id);
    reloadComments();
  };

  const showGutter = loaded && !binary && !(isMd && preview);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[12px]">
        <FileTypeIcon name={name} size={15} />
        <span className="font-medium">{name}</span>
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Unsaved changes" />}
        {comments.length > 0 && (
          <span className="chip text-[10px]" title={`${comments.length} comment${comments.length > 1 ? 's' : ''} on this file`}>💬 {comments.length}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {isMd && (
            <button className="chip text-[11px]" onClick={() => setPreview((p) => !p)}>
              {preview ? 'Source' : 'Preview'}
            </button>
          )}
          {!binary && !truncated && (
            <button className="btn btn-ghost px-2 py-0.5 text-[11px]" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <button className="rounded p-1 text-ink-faint hover:text-ink" title="Reveal in OS"
            onClick={() => window.nekko.openPath(path)}><ExternalIcon className="h-3.5 w-3.5" /></button>
        </span>
      </div>

      {truncated && (
        <div className="border-b border-line px-3 py-1 text-[11px] text-amber-500">
          Large file, showing the first part only; editing is disabled.
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showGutter && (
          <div className="relative w-11 shrink-0 overflow-hidden border-r border-line text-right" style={{ background: 'var(--surface-2)' }}>
            <div style={{ transform: `translateY(${-scrollTop}px)` }} className="pt-3">
              {lines.map((_, i) => {
                const ln = i + 1;
                const has = byLine.has(ln);
                const isActive = activeLine === ln;
                return (
                  <div
                    key={ln}
                    className={`group/g relative cursor-pointer pr-1.5 font-mono text-[11px] ${isActive ? 'text-accent' : 'text-ink-faint hover:text-ink'}`}
                    style={{ height: LINE_H, lineHeight: `${LINE_H}px` }}
                    onClick={() => setActiveLine(ln)}
                    title={has ? 'View comment' : 'Comment on this line'}
                  >
                    <span className="opacity-0 transition-opacity group-hover/g:opacity-0">{has ? '' : ln}</span>
                    <span className={`absolute inset-y-0 left-0 flex items-center pl-1 text-accent ${has ? '' : 'opacity-0 group-hover/g:opacity-100'}`}>
                      {has ? '●' : '+'}
                    </span>
                    {!has && <span className="absolute inset-y-0 right-1.5 flex items-center group-hover/g:opacity-0">{ln}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {!loaded ? (
            <p className="p-4 text-[12px] text-ink-faint">Loading…</p>
          ) : binary ? (
            <p className="p-4 text-[12px] text-ink-faint">Binary file, can't display as text.</p>
          ) : isMd && preview ? (
            <div className="px-5 py-4"><Markdown text={content} /></div>
          ) : (
            <textarea
              ref={taRef}
              className="h-full w-full resize-none whitespace-pre bg-transparent px-3 pt-3 font-mono outline-none"
              style={{ fontSize: '12.5px', lineHeight: `${LINE_H}px` }}
              spellCheck={false}
              wrap="off"
              value={content}
              readOnly={truncated}
              onScroll={(e) => setScrollTop((e.target as HTMLTextAreaElement).scrollTop)}
              onKeyDown={onKeyDown}
              onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            />
          )}
        </div>
      </div>

      {activeLine != null && showGutter && (
        <CommentDock
          line={activeLine}
          lineText={lines[activeLine - 1] ?? ''}
          comments={byLine.get(activeLine) ?? []}
          onClose={() => setActiveLine(null)}
          onAdd={addComment}
          onResolve={resolveComment}
          onResend={(c, run) => sendToChat(commentBlock(name, c.line, c.lineText, c.comment), run)}
        />
      )}
    </div>
  );
}

/** Bottom dock to read/add comments on the active line and route them to a chat. */
function CommentDock({
  line, lineText, comments, onClose, onAdd, onResolve, onResend,
}: {
  line: number;
  lineText: string;
  comments: LineComment[];
  onClose: () => void;
  onAdd: (text: string, action: 'save' | 'prompt' | 'run') => void | Promise<void>;
  onResolve: (id: string) => void;
  onResend: (c: LineComment, run: boolean) => void;
}) {
  const [text, setText] = useState('');
  const act = (action: 'save' | 'prompt' | 'run') => { onAdd(text, action); setText(''); };
  return (
    <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-line px-3 py-2" style={{ background: 'var(--surface-2)' }}>
      <div className="mb-1.5 flex items-center gap-2 text-[12px]">
        <span className="font-semibold text-accent">Line {line}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-faint">{lineText.trim() || '(empty line)'}</code>
        <button className="rounded p-0.5 text-ink-faint hover:text-ink" title="Close" onClick={onClose}><CloseIcon className="h-3.5 w-3.5" /></button>
      </div>

      {comments.map((c) => (
        <div key={c.id} className="mb-1.5 rounded-lg border border-line p-2" style={{ background: 'var(--paper)' }}>
          <p className="whitespace-pre-wrap text-[12.5px]">{c.comment}</p>
          <div className="mt-1 flex items-center gap-3 text-[10.5px] text-ink-faint">
            <button className="hover:text-accent" onClick={() => onResend(c, false)} title="Queue into the composer">Add to prompt</button>
            <button className="hover:text-accent" onClick={() => onResend(c, true)} title="Send to the agent now">Run now</button>
            <button className="ml-auto hover:text-ink" onClick={() => onResolve(c.id)} title="Remove this comment">Resolve</button>
          </div>
        </div>
      ))}

      <textarea
        className="input min-h-[44px] resize-none text-[12.5px]"
        rows={2}
        placeholder="Comment on this line for the agent…"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); act('prompt'); } }}
      />
      <div className="mt-1.5 flex items-center justify-end gap-2 text-[12px]">
        <button className="btn btn-ghost py-1" disabled={!text.trim()} onClick={() => act('save')} title="Save as a note (no agent)">Save</button>
        <button className="btn btn-outline py-1" disabled={!text.trim()} onClick={() => act('prompt')}>Add to prompt</button>
        <button className="btn btn-primary py-1" disabled={!text.trim()} onClick={() => act('run')}>Run now</button>
      </div>
    </div>
  );
}
