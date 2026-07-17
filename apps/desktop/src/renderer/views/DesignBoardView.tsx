import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentEvent, DesignBoard, DesignPage } from '@kotrain/shared';
import { useStore } from '../store.js';
import { PlusIcon, CloseIcon, ExternalIcon, TrashIcon } from '../icons.js';

/**
 * Design board, the app's UI pages laid out like a Figma board. Each card is a
 * live, scaled-down "snapshot" (a read-only preview) of a page; click one to pin
 * persistent notes or leave a comment the agent picks up (Add to prompt / Run
 * now). As an agent edits the UI the previews reload so you watch the design
 * update live, and an "updating" badge links back to the agent doing the work.
 */
export function DesignBoardView() {
  const { settings, sessions, activeWorkspaceId, setActiveWorkspace, sendToChat, openChatPane } = useStore();
  const workspaces = settings?.workspaces ?? [];
  const wsId = activeWorkspaceId && workspaces.some((w) => w.id === activeWorkspaceId)
    ? activeWorkspaceId
    : workspaces[0]?.id ?? null;

  const [board, setBoard] = useState<DesignBoard | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  // Sessions in this workspace whose agent is actively working (→ "updating").
  const [working, setWorking] = useState<Set<string>>(new Set());

  const load = () => { if (wsId) window.nekko.getDesignBoard(wsId).then(setBoard).catch(() => setBoard(null)); };
  useEffect(() => { setSelected(null); load(); /* eslint-disable-next-line */ }, [wsId]);

  // An agent editing files in this workspace marks pages "updating" and reloads
  // their previews so changes show up as they land.
  const wsSessionIds = useMemo(
    () => new Set(sessions.filter((s) => (s.workspaceId ?? null) === wsId).map((s) => s.id)),
    [sessions, wsId],
  );
  useEffect(() => {
    const off = window.nekko.onAgentEvent((e: AgentEvent) => {
      if (!wsSessionIds.has(e.sessionId)) return;
      setWorking((prev) => {
        const n = new Set(prev);
        if (e.type === 'done' || e.type === 'error') n.delete(e.sessionId);
        else n.add(e.sessionId);
        return n;
      });
      if (e.type === 'done') setReloadNonce((x) => x + 1);
    });
    return off;
  }, [wsSessionIds]);
  useEffect(() => {
    const off = window.nekko.onChangesUpdated((e) => { if (wsSessionIds.has(e.sessionId)) setReloadNonce((x) => x + 1); });
    return off;
  }, [wsSessionIds]);

  const updating = working.size > 0;
  const runningSessionId = [...working][0] ?? null;
  const goToAgent = () => { if (runningSessionId) { openChatPane(runningSessionId); useStore.getState().setView('chat'); } };

  const pages = board?.pages ?? [];
  const selectedPage = pages.find((p) => p.id === selected) ?? null;

  const addPage = async (label: string, url: string) => {
    if (!wsId || !url.trim()) return;
    setBoard(await window.nekko.addDesignPage(wsId, label, url));
    setAdding(false);
  };
  const removePage = async (pageId: string) => {
    if (!wsId) return;
    setBoard(await window.nekko.removeDesignPage(wsId, pageId));
    if (selected === pageId) setSelected(null);
  };

  if (!wsId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl text-3xl" style={{ background: 'var(--accent-soft)' }}>🎨</div>
        <h2 className="text-lg font-semibold">Design board</h2>
        <p className="max-w-sm text-[13px] text-ink-faint">Add a project in <b>Projects</b> first, the design board shows your app's pages as a Figma-style board of live snapshots.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <h1 className="text-[15px] font-semibold">Design</h1>
        {workspaces.length > 1 && (
          <select className="input py-1 text-[12px]" value={wsId} onChange={(e) => setActiveWorkspace(e.target.value)}>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        {updating && (
          <button className="chip flex items-center gap-1.5 text-[11px] text-accent" onClick={goToAgent} title="An agent is updating your app, open its chat">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Updating… open agent
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            Zoom
            <input type="range" min={0.5} max={1.5} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <button className="btn btn-ghost px-2 py-1 text-[12px]" title="Reload all previews" onClick={() => setReloadNonce((x) => x + 1)}>↻</button>
          <button className="btn btn-primary px-2.5 py-1 text-[12px]" onClick={() => setAdding(true)}><PlusIcon className="h-3.5 w-3.5" /> Add page</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto p-5" style={{ background: 'var(--surface-2)' }}>
          {adding && <AddPageForm onAdd={addPage} onCancel={() => setAdding(false)} />}
          {pages.length === 0 && !adding ? (
            <div className="mt-16 text-center text-[13px] text-ink-faint">
              No pages yet. <button className="text-accent hover:underline" onClick={() => setAdding(true)}>Add a page</button> (a label + the URL it runs at, e.g. <code className="font-mono">http://localhost:3000</code>).
            </div>
          ) : (
            <div className="flex flex-wrap gap-5">
              {pages.map((p) => (
                <PageCard
                  key={p.id}
                  page={p}
                  zoom={zoom}
                  reloadNonce={reloadNonce}
                  updating={updating}
                  active={selected === p.id}
                  onOpen={() => setSelected(p.id)}
                  onUpdatingClick={goToAgent}
                />
              ))}
            </div>
          )}
        </div>

        {selectedPage && (
          <PageSheet
            key={selectedPage.id}
            page={selectedPage}
            onClose={() => setSelected(null)}
            onRemove={() => removePage(selectedPage.id)}
            onOpenBrowser={() => { useStore.getState().openBrowserPane(selectedPage.url); useStore.getState().setView('chat'); }}
            onAddNote={async (text) => { if (wsId) setBoard(await window.nekko.addDesignNote(wsId, selectedPage.id, text)); }}
            onResolveNote={async (id) => { if (wsId) setBoard(await window.nekko.resolveDesignNote(wsId, selectedPage.id, id)); }}
            onComment={(text, run) => sendToChat(`Re design page "${selectedPage.label}" (${selectedPage.url}), ${text}`, run)}
          />
        )}
      </div>
    </div>
  );
}

/** A scaled live preview of one page, plus its label and an "updating" badge. */
function PageCard({
  page, zoom, reloadNonce, updating, active, onOpen, onUpdatingClick,
}: {
  page: DesignPage; zoom: number; reloadNonce: number; updating: boolean; active: boolean;
  onOpen: () => void; onUpdatingClick: () => void;
}) {
  const W = Math.round(340 * zoom);
  const H = Math.round(W * 0.64);
  const LOGICAL = 1280; // render the page at desktop width, then scale to fit
  const scale = W / LOGICAL;
  return (
    <div
      className={`card overflow-hidden p-0 transition-shadow ${active ? 'ring-2 ring-accent' : ''}`}
      style={{ width: W }}
    >
      <div className="relative cursor-pointer" style={{ height: H, background: '#fff' }} onClick={onOpen} title="Open notes & comments">
        <iframe
          key={`${page.id}:${reloadNonce}`}
          src={page.url}
          title={page.label}
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: LOGICAL, height: Math.round(H / scale), border: 0,
            transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none',
          }}
        />
        {/* Click-catcher so the read-only preview opens the sheet instead of interacting. */}
        <div className="absolute inset-0" />
        {updating && (
          <button
            className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow"
            style={{ background: 'var(--accent)' }}
            onClick={(e) => { e.stopPropagation(); onUpdatingClick(); }}
            title="An agent is updating your app, open its chat"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> updating
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-2.5 py-1.5">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="truncate text-[12.5px] font-medium">{page.label}</div>
          <div className="truncate text-[10.5px] text-ink-faint">{page.url}</div>
        </button>
        {page.notes.length > 0 && <span className="chip text-[10px]" title={`${page.notes.length} note(s)`}>📌 {page.notes.length}</span>}
      </div>
    </div>
  );
}

/** Add-a-page inline form. */
function AddPageForm({ onAdd, onCancel }: { onAdd: (label: string, url: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('http://localhost:3000');
  return (
    <div className="card mb-5 max-w-lg p-3">
      <div className="mb-2 text-[12px] font-semibold">Add a page</div>
      <div className="flex flex-col gap-2">
        <input className="input text-[12.5px]" placeholder="Label (e.g. Home)" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        <input className="input font-mono text-[12px]" placeholder="http://localhost:3000/path" value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(label, url); }} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button className="btn btn-ghost py-1 text-[12px]" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary py-1 text-[12px]" disabled={!url.trim()} onClick={() => onAdd(label, url)}>Add</button>
      </div>
    </div>
  );
}

/** Right drawer for a page: bigger preview, persistent notes, and a comment box. */
function PageSheet({
  page, onClose, onRemove, onOpenBrowser, onAddNote, onResolveNote, onComment,
}: {
  page: DesignPage;
  onClose: () => void;
  onRemove: () => void;
  onOpenBrowser: () => void;
  onAddNote: (text: string) => void | Promise<void>;
  onResolveNote: (id: string) => void | Promise<void>;
  onComment: (text: string, run: boolean) => void | Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const noteRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line" style={{ background: 'var(--paper)' }}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{page.label}</div>
          <div className="truncate text-[10.5px] text-ink-faint">{page.url}</div>
        </div>
        <button className="rounded p-1 text-ink-faint hover:text-ink" title="Open in browser pane" onClick={onOpenBrowser}><ExternalIcon className="h-3.5 w-3.5" /></button>
        <button className="rounded p-1 text-ink-faint hover:text-red-400" title="Remove page" onClick={onRemove}><TrashIcon className="h-3.5 w-3.5" /></button>
        <button className="rounded p-1 text-ink-faint hover:text-ink" title="Close" onClick={onClose}><CloseIcon className="h-3.5 w-3.5" /></button>
      </div>

      <div className="px-3 py-3">
        {/* Notes, persistent */}
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Notes</div>
        {page.notes.length === 0 && <p className="mb-2 text-[12px] text-ink-faint">No notes yet, pin design intent that sticks with this page.</p>}
        {page.notes.map((n) => (
          <div key={n.id} className="mb-1.5 flex items-start gap-2 rounded-lg border border-line p-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap text-[12.5px]">{n.text}</p>
            <button className="shrink-0 text-[10.5px] text-ink-faint hover:text-ink" onClick={() => onResolveNote(n.id)} title="Remove note">✕</button>
          </div>
        ))}
        <div className="mt-1 flex gap-1.5">
          <input ref={noteRef} className="input flex-1 text-[12px]" placeholder="Pin a note…" value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { onAddNote(note); setNote(''); } }} />
          <button className="btn btn-outline px-2 py-1 text-[12px]" disabled={!note.trim()} onClick={() => { onAddNote(note); setNote(''); noteRef.current?.focus(); }}>Pin</button>
        </div>

        {/* Comment, routes to the agent */}
        <div className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Comment for the agent</div>
        <textarea className="input min-h-[60px] resize-none text-[12.5px]" rows={3} placeholder="Describe a change to this page…"
          value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="mt-1.5 flex justify-end gap-2">
          <button className="btn btn-outline py-1 text-[12px]" disabled={!comment.trim()} onClick={() => { onComment(comment, false); setComment(''); }}>Add to prompt</button>
          <button className="btn btn-primary py-1 text-[12px]" disabled={!comment.trim()} onClick={() => { onComment(comment, true); setComment(''); }}>Run now</button>
        </div>
      </div>
    </aside>
  );
}
