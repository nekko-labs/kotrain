import React, { useEffect, useRef, useState } from 'react';
import type { ChatMode, Session } from '@kotrain/shared';
import { useStore } from '../store.js';
import { WrenchIcon, PlaneIcon, MaskIcon } from '../icons.js';

const MODE_LABEL: Record<ChatMode, string> = { ask: 'Ask', guardrails: 'Guardrails', yolo: 'YOLO' };
const MODE_DESC: Record<ChatMode, string> = {
  ask: 'Confirm every file write and command.',
  guardrails: 'Run freely; ask/deny per guardrail rules.',
  yolo: 'Run everything (deny rules still block).',
};

/**
 * The per-chat execution row of the instrument strip above the composer: how
 * tools run (mode, which tools) on the left, and the two privacy switches
 * (Offline, Incognito) parked on the right behind a hairline divider, so
 * "what this agent may do" reads apart from "what it may reach".
 *
 * The two families look different on purpose: value pickers are bordered fields
 * with a caret (`.ctl-menu`), switches are quiet until hovered and show their
 * on-state with color and a lit dot rather than a filled pill (`.ctl-toggle`).
 */
export function ChatControls({
  session,
  isCloudModel,
  onChange,
}: {
  session: Session | null;
  isCloudModel: boolean;
  onChange: (s: Session | null) => void;
}) {
  const settings = useStore((s) => s.settings);
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [toolQuery, setToolQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { window.nekko.listTools().then(setTools); }, []);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setToolsOpen(false); setModeOpen(false); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setToolsOpen(false); setModeOpen(false); }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  if (!session) return null;

  const mode: ChatMode = session.mode ?? settings?.defaultChatMode ?? 'guardrails';
  const disabled = new Set(session.disabledTools ?? []);
  const enabledCount = tools.length - disabled.size;
  const offline = !!session.offline;
  const incognito = !!session.incognito;
  const shownTools = toolQuery.trim()
    ? tools.filter((t) => t.name.toLowerCase().includes(toolQuery.trim().toLowerCase()))
    : tools;

  const patch = async (p: Partial<Session>) => {
    const next = await window.nekko.setSessionOptions(session.id, p as any);
    onChange(next);
  };

  const toggleTool = (name: string) => {
    const next = new Set(disabled);
    next.has(name) ? next.delete(name) : next.add(name);
    patch({ disabledTools: [...next] });
  };

  return (
    <div ref={ref} className="flex w-full min-w-0 items-center gap-1.5 text-[12px]">
      {/* Mode */}
      <div className="relative shrink-0">
        <button
          className="ctl-menu whitespace-nowrap"
          onClick={() => { setModeOpen((o) => !o); setToolsOpen(false); }}
          aria-haspopup="menu"
          aria-expanded={modeOpen}
          title={MODE_DESC[mode]}
        >
          <span className="ctl-menu-label">Mode</span>
          {MODE_LABEL[mode]}
          <span className="ctl-caret">▾</span>
        </button>
        {modeOpen && (
          <div className="card absolute bottom-8 left-0 z-40 w-60 p-1.5 shadow-lg" role="menu">
            {(['ask', 'guardrails', 'yolo'] as ChatMode[]).map((m) => (
              <button
                key={m}
                role="menuitemradio"
                aria-checked={mode === m}
                className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2 ${mode === m ? 'text-accent' : ''}`}
                onClick={() => { patch({ mode: m }); setModeOpen(false); }}
              >
                <span className="text-[13px] font-medium">{MODE_LABEL[m]}</span>
                <span className="text-[11px] text-ink-faint">{MODE_DESC[m]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="relative shrink-0">
        <button
          className="ctl-menu whitespace-nowrap"
          onClick={() => { setToolsOpen((o) => !o); setModeOpen(false); setToolQuery(''); }}
          disabled={offline}
          aria-haspopup="menu"
          aria-expanded={toolsOpen}
          title={offline ? 'Tools are off in Offline mode' : 'Enable/disable tools for this chat'}
        >
          <WrenchIcon className="h-3 w-3 text-ink-faint" />
          <span className="ctl-menu-label">Tools</span>
          <span className="tabular-nums">{offline ? 'off' : `${enabledCount}/${tools.length}`}</span>
          <span className="ctl-caret">▾</span>
        </button>
        {toolsOpen && !offline && (
          <div className="card absolute bottom-8 left-0 z-40 flex max-h-80 w-64 flex-col p-1.5 shadow-lg">
            {tools.length > 7 && (
              <input
                className="input mb-1 rounded-lg px-2.5 py-1 text-[12px]"
                placeholder="Filter tools…"
                value={toolQuery}
                autoFocus
                aria-label="Filter tools"
                onChange={(e) => setToolQuery(e.target.value)}
              />
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {shownTools.length === 0 && <p className="px-2.5 py-1.5 text-[11px] text-ink-faint">No tools match.</p>}
              {shownTools.map((t) => {
                const on = !disabled.has(t.name);
                return (
                  <button
                    key={t.name}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2"
                    onClick={() => toggleTool(t.name)}
                    title={t.description}
                    role="menuitemcheckbox"
                    aria-checked={on}
                  >
                    <span className="mt-0.5 text-[12px]" style={{ color: on ? 'var(--accent)' : 'var(--ink-faint)' }}>{on ? '☑' : '☐'}</span>
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px]">
                        {t.name.startsWith('mcp__') ? `🔌 ${t.name.split('__').slice(2).join('__')}` : t.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-faint">{t.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* The privacy switches sit apart from the execution controls: pushed to
          the right edge of the row, behind a hairline. */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <span className="mr-0.5 h-4 w-px bg-line" aria-hidden="true" />

        {/* Offline */}
        <button
          className="ctl-toggle whitespace-nowrap"
          onClick={() => !isCloudModel && patch({ offline: !offline })}
          disabled={isCloudModel}
          aria-pressed={offline}
          title={isCloudModel ? 'Offline mode is only for local models' : 'No tools, no connectors, no internet'}
        >
          <span className="ctl-dot" />
          <PlaneIcon className="h-3 w-3" /> Offline
        </button>

        {/* Incognito */}
        <button
          className="ctl-toggle ctl-toggle-neutral whitespace-nowrap"
          onClick={() => patch({ incognito: !incognito })}
          aria-pressed={incognito}
          title="Don't save this chat or update memory"
        >
          <span className="ctl-dot" />
          <MaskIcon className="h-3 w-3" /> Incognito
        </button>
      </div>
    </div>
  );
}
