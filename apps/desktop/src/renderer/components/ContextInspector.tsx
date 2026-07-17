import React, { useEffect, useState } from 'react';
import type { ContextBundle, ContextItem } from '@kotrain/shared';
import { getSessionWorkspaceIds, estimateTokens } from '@kotrain/shared';
import { FolderIcon, FileIcon, PlusIcon, TrashIcon, ExternalIcon } from '../icons.js';
import { useStore } from '../store.js';
import { SpecPanel } from './SpecPanel.js';

const SOURCE_LABEL: Record<ContextItem['source'], string> = {
  'attached-file': 'Files',
  guideline: 'Guidelines',
  memory: 'Memory',
  connector: 'Connectors',
  'index-snippet': 'Code index',
  system: 'System prompt',
  conversation: 'Conversation',
  skill: 'Skill',
};

const SOURCE_COLOR: Record<ContextItem['source'], string> = {
  'attached-file': '#5b9dd9',
  guideline: '#c08adb',
  memory: '#e0a44a',
  connector: '#4ec98a',
  'index-snippet': '#8a8f98',
  system: '#8a8f98',
  conversation: '#6d5efc',
  skill: '#e0574a',
};

/** Plain-language explanation of each context source, shown on hover. */
const SOURCE_EXPLAIN: Record<ContextItem['source'], string> = {
  system: "Kotrain's base instructions to the model, its role, available tools, and safety rules. Always included.",
  guideline: 'Your project guideline files (AGENTS.md / CLAUDE.md and similar) that tell the model how to work in this repo.',
  memory: 'Facts Kotrain remembers across chats, your preferences and project notes, that match this conversation.',
  'attached-file': 'Files you attached to this chat. Included in full on every turn.',
  connector: 'Content pulled from your connected tools and integrations that is relevant to this prompt.',
  'index-snippet': "Code snippets retrieved from your workspace index that match this turn's prompt.",
  conversation: 'The running back-and-forth of this chat. Grows every turn — the biggest driver of context as a chat gets long.',
  skill: 'The skill armed in the composer. Its instructions are added to your message when you send.',
};

/** A small "i" badge that reveals an explanation on hover. */
function InfoHint({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-flex">
      <span className="grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-line text-[8px] font-bold text-ink-faint">i</span>
      <span
        className="pointer-events-none absolute left-0 top-5 z-50 hidden w-56 rounded-xl border border-line p-2.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-ink-soft shadow-lg group-hover/info:block"
        style={{ background: 'var(--surface)' }}
      >
        {text}
      </span>
    </span>
  );
}

/** Last path segment, handling both POSIX and Windows separators. */
function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

/**
 * The Context Inspector, Kotrain's signature panel. Two parts:
 *  1. Sources, the folders, attached files, and key context files (spec.md,
 *     guidelines) wired into this chat, each addable/openable.
 *  2. Breakdown, exactly what enters the prompt this turn, grouped by
 *     provenance, each item toggleable and pinnable, with live token counts.
 */
export function ContextInspector({ sessionId }: { sessionId: string | null }) {
  const settings = useStore((s) => s.settings);
  const sessions = useStore((s) => s.sessions);
  const refreshSettings = useStore((s) => s.refreshSettings);
  const refreshSessions = useStore((s) => s.refreshSessions);

  const [bundle, setBundle] = useState<ContextBundle | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const workspaces = settings?.workspaces ?? [];
  const attached = session?.attachedPaths ?? [];
  // The skill armed in this chat's composer (renderer-only until sent), so we can
  // show it in the window and count its tokens live.
  const activeSkill = useStore((s) => (sessionId ? s.activeSkillBySession[sessionId] ?? null : null));

  const refreshBundle = () => {
    if (!sessionId) return;
    window.nekko.previewContext(sessionId, []).then((b) => {
      setBundle(b);
      setExcluded(new Set(b.items.filter((i) => !i.included).map((i) => i.id)));
      setPinned(new Set(b.items.filter((i) => i.pinned).map((i) => i.id)));
    });
  };

  useEffect(() => {
    if (!sessionId) {
      setBundle(null);
      return;
    }
    refreshBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, attached.length, session?.workspaceId, session?.supportingWorkspaceIds?.length, session?.messages.length]);

  if (!sessionId) return <Empty />;

  const persist = (nextExcluded: Set<string>, nextPinned: Set<string>) => {
    window.nekko.setContextPrefs(sessionId, { excluded: [...nextExcluded], pinned: [...nextPinned] });
  };

  const toggle = (id: string) => {
    const nextExcluded = new Set(excluded);
    const nextPinned = new Set(pinned);
    if (nextExcluded.has(id)) {
      nextExcluded.delete(id);
    } else {
      nextExcluded.add(id);
      nextPinned.delete(id);
    }
    setExcluded(nextExcluded);
    setPinned(nextPinned);
    persist(nextExcluded, nextPinned);
  };

  const togglePin = (id: string) => {
    const nextExcluded = new Set(excluded);
    const nextPinned = new Set(pinned);
    if (nextPinned.has(id)) {
      nextPinned.delete(id);
    } else {
      nextPinned.add(id);
      nextExcluded.delete(id);
    }
    setExcluded(nextExcluded);
    setPinned(nextPinned);
    persist(nextExcluded, nextPinned);
  };

  // --- Sources actions ---
  const addFolder = async () => {
    await window.nekko.addWorkspace();
    await refreshSettings();
  };
  const removeFolder = async (id: string) => {
    await window.nekko.removeWorkspace(id);
    if (session) {
      const supporting = (session.supportingWorkspaceIds ?? []).filter((wid) => wid !== id);
      if (session.workspaceId === id) {
        const [nextPrimary, ...nextSupporting] = supporting;
        await window.nekko.setSessionWorkspace(sessionId, nextPrimary);
        await window.nekko.setSessionSupportingWorkspaces(sessionId, nextSupporting);
      } else {
        await window.nekko.setSessionSupportingWorkspaces(sessionId, supporting);
      }
      await refreshSessions();
    }
    await refreshSettings();
  };
  const setFolderSelection = async (primaryId: string | undefined, supportingIds: string[]) => {
    await window.nekko.setSessionWorkspace(sessionId, primaryId);
    await window.nekko.setSessionSupportingWorkspaces(sessionId, supportingIds);
    await refreshSessions();
  };
  const includeFolder = async (id: string) => {
    if (!session?.workspaceId) {
      await setFolderSelection(id, session?.supportingWorkspaceIds ?? []);
    } else {
      await setFolderSelection(session.workspaceId, [...(session.supportingWorkspaceIds ?? []), id]);
    }
  };
  const excludeFolder = async (id: string) => {
    if (session?.workspaceId === id) {
      const [nextPrimary, ...nextSupporting] = session.supportingWorkspaceIds ?? [];
      await setFolderSelection(nextPrimary, nextSupporting);
    } else {
      await setFolderSelection(session?.workspaceId, (session?.supportingWorkspaceIds ?? []).filter((wid) => wid !== id));
    }
  };
  const makePrimary = async (id: string) => {
    if (!session || session.workspaceId === id) return;
    await setFolderSelection(id, [
      ...(session.workspaceId ? [session.workspaceId] : []),
      ...(session.supportingWorkspaceIds ?? []).filter((wid) => wid !== id),
    ]);
  };
  const useFolder = async (id: string) => {
    const included = getSessionWorkspaceIds(session ?? { workspaceId: undefined }).includes(id);
    if (included) await makePrimary(id);
    else await includeFolder(id);
  };
  const addFiles = async () => {
    const picked = await window.nekko.openFilesDialog();
    if (!picked.length) return;
    const next = Array.from(new Set([...attached, ...picked]));
    await window.nekko.setSessionAttachments(sessionId, next);
    await refreshSessions();
  };
  const removeFile = async (path: string) => {
    await window.nekko.setSessionAttachments(sessionId, attached.filter((p) => p !== path));
    await refreshSessions();
  };
  const open = (target: string) => window.nekko.openPath(target);

  const visible = (bundle?.items ?? []).map((i) => ({
    ...i,
    included: !excluded.has(i.id),
    pinned: pinned.has(i.id),
  }));
  const skillTokens = activeSkill ? estimateTokens(activeSkill.template) : 0;
  const total = visible.filter((i) => i.included).reduce((s, i) => s + i.tokens, 0) + skillTokens;
  const windowTokens = bundle?.contextWindow ?? 128000;
  const pct = Math.min(100, (total / windowTokens) * 100);
  const guidelineItems = visible.filter((i) => i.source === 'guideline');
  const memoryItems = visible.filter((i) => i.source === 'memory');

  // Compact "where the tokens go" summary: sum included items per source, then
  // fold in the armed skill so its weight is visible before it's even sent.
  const bySource = visible
    .filter((i) => i.included)
    .reduce<Record<string, number>>((acc, i) => {
      acc[i.source] = (acc[i.source] ?? 0) + i.tokens;
      return acc;
    }, {});
  if (skillTokens) bySource.skill = (bySource.skill ?? 0) + skillTokens;
  const breakdown = Object.entries(bySource)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex h-full w-80 flex-col border-l border-line">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Context</h3>
          <span className="chip">{total.toLocaleString()} tok</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 85 ? '#e0574a' : 'var(--accent)' }} />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          {Math.round(pct)}% of the {windowTokens.toLocaleString()}-token window · updates every turn.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Armed skill: highlighted, with its token weight (Claude-Code style). */}
        {activeSkill && (
          <div className="rounded-xl border border-accent/40 p-3" style={{ background: 'var(--accent-soft)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="skill-pill text-[12px]">
                <span className="skill-pill-slash">/</span>{activeSkill.name}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-accent">{skillTokens.toLocaleString()} tok</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{activeSkill.description}</p>
            <p className="mt-1 text-[10.5px] text-ink-faint">Added to your message when you send. Not typed into the box.</p>
          </div>
        )}

        {/* Where the tokens go — a compact, always-accurate breakdown. */}
        {breakdown.length > 0 && (
          <Section title="In the window" info="Everything that enters the model's prompt this turn, by source. The conversation grows every turn, which is what makes a long chat fill the window.">
            <div className="space-y-1">
              {breakdown.map(([src, n]) => (
                <div key={src} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SOURCE_COLOR[src as ContextItem['source']] ?? '#8a8f98' }} />
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{SOURCE_LABEL[src as ContextItem['source']] ?? src}</span>
                  <span className="shrink-0 text-ink-faint">{n.toLocaleString()} tok</span>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-2 border-t border-line pt-1.5 text-[12px] font-medium">
                <span className="min-w-0 flex-1 text-ink">Total</span>
                <span className="shrink-0 text-ink">{total.toLocaleString()} tok</span>
              </div>
            </div>
          </Section>
        )}

        {/* Sources: folders */}
        <Section title="Folders" info="Project folders grounding this chat. The active folder's files can be read and searched by the agent, and set the working directory for terminals and tools." onAdd={addFolder} addLabel="Add folder">
          {workspaces.length === 0 && <Hint>No folder yet. Add one to ground the chat in your code.</Hint>}
          {workspaces.map((w) => {
            const included = getSessionWorkspaceIds(session ?? { workspaceId: undefined }).includes(w.id);
            const primary = session?.workspaceId === w.id;
            return (
              <Row
                key={w.id}
                active={primary}
                icon={<FolderIcon className="h-3.5 w-3.5" />}
                title={baseName(w.path) || w.path}
                subtitle={w.path}
                onClick={() => useFolder(w.id)}
                badge={included ? (primary ? 'primary' : 'supporting') : undefined}
                badgeAction={included && !primary ? () => makePrimary(w.id) : undefined}
                included={included}
                onToggle={() => (included ? excludeFolder(w.id) : includeFolder(w.id))}
                onRemove={() => removeFolder(w.id)}
              />
            );
          })}
        </Section>

        {/* Sources: attached files */}
        <Section title="Files" info="Files you attach are pinned into every turn of this chat verbatim, use them for specs, snippets, or docs the model should always see." onAdd={addFiles} addLabel="Attach files">
          {attached.length === 0 && <Hint>Attach files to pin them into every turn of this chat.</Hint>}
          {attached.map((p) => (
            <Row
              key={p}
              icon={<FileIcon className="h-3.5 w-3.5" />}
              title={baseName(p)}
              subtitle={p}
              onClick={() => open(p)}
              onRemove={() => removeFile(p)}
            />
          ))}
        </Section>

        {/* Sources: guidelines & memory */}
        {(guidelineItems.length > 0 || memoryItems.length > 0) && (
          <Section title="Guidelines" info="Always-on project guidelines and memory relevant to this chat.">
            {guidelineItems.map((g) => (
              <Row
                key={g.id}
                icon={<FileIcon className="h-3.5 w-3.5" />}
                title={g.label}
                subtitle={g.origin}
                onClick={() => open(g.origin)}
                included={g.included}
                onToggle={() => toggle(g.id)}
              />
            ))}
            {memoryItems.map((m) => (
              <Row
                key={m.id}
                icon={<FileIcon className="h-3.5 w-3.5" />}
                title={m.label}
                subtitle={m.preview}
                included={m.included}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </Section>
        )}

        {/* Spec-driven development */}
        <SpecPanel sessionId={sessionId} session={session} />

      </div>
    </div>
  );
}

function Section({
  title,
  info,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  info?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {title}
          {info && <InfoHint text={info} />}
        </span>
        {onAdd && (
          <button className="text-ink-faint hover:text-ink" title={addLabel} onClick={onAdd}>
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  active,
  badge,
  badgeAction,
  onClick,
  onRemove,
  included,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  active?: boolean;
  badge?: string;
  badgeAction?: () => void;
  onClick?: () => void;
  onRemove?: () => void;
  included?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
        active ? 'border-accent/40 bg-accent/5' : 'border-line'
      } ${onClick ? 'cursor-pointer hover:bg-surface-2' : ''} ${included === false ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      <span className={active ? 'text-accent' : 'text-ink-faint'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-medium">{title}</span>
          {badge && (badgeAction ? (
            <button
              className="chip shrink-0 cursor-pointer text-[9px] uppercase hover:text-accent"
              onClick={(e) => {
                e.stopPropagation();
                badgeAction();
              }}
              title="Make primary"
            >
              {badge}
            </button>
          ) : <span className="chip shrink-0 text-[9px] uppercase">{badge}</span>)}
          {onClick && <ExternalIcon className="h-3 w-3 shrink-0 text-ink-faint opacity-0 group-hover:opacity-100" />}
        </div>
        {subtitle && <p className="truncate text-[10.5px] text-ink-faint">{subtitle}</p>}
      </div>
      {onRemove && (
        <button
          className="shrink-0 text-ink-faint opacity-0 hover:text-red-400 group-hover:opacity-100"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}
      {onToggle && (
        <input
          type="checkbox"
          className="shrink-0 accent-[var(--accent)]"
          checked={included !== false}
          aria-label={included === false ? `Include ${title}` : `Exclude ${title}`}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
        />
      )}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-[11px] leading-snug text-ink-faint">{children}</p>;
}

function Empty() {
  return (
    <div className="flex h-full w-80 flex-col items-center justify-center border-l border-line p-6 text-center">
      <h3 className="text-sm font-semibold">Context</h3>
      <p className="mt-2 text-[12px] text-ink-faint">Start or open a chat to see and manage its context here.</p>
    </div>
  );
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
