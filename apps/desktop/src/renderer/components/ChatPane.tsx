import React, { useEffect, useRef, useState } from 'react';
import type { AgentEvent, ChatMessage, Session, ToolCall, ContextBundle, IndexedFile, ModelInfo } from '@open-paw/shared';
import { estimateCostUSD, recommendModel, AUTO_MODEL_ID, matchSkills } from '@open-paw/shared';
import { useStore } from '../store.js';
import { Markdown } from './Markdown.js';
import { ContextInspector } from './ContextInspector.js';
import { ChatMetrics } from './ChatMetrics.js';
import { ChatControls } from './ChatControls.js';
import { PromptAnalyzer } from './PromptAnalyzer.js';
import { ScheduleTaskModal } from './ScheduleTaskModal.js';
import { SendIcon, PanelIcon, ShieldIcon, DownloadIcon } from '../icons.js';

const LOCAL_KINDS = ['ollama', 'lmstudio', 'vllm', 'openai-compat'];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface PendingApproval {
  call: ToolCall;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * One chat conversation, fully self-contained so several can run side by side in
 * the workbench. Provider/model are chosen per-pane (independent agents); the
 * pane subscribes to agent events filtered by its own sessionId.
 */
export function ChatPane({ sessionId, onRunningChange }: { sessionId: string; onRunningChange?: (running: boolean) => void }) {
  const { providers, settings, setMascotMood, refreshSessions, activeWorkspaceId } = useStore();

  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [liveReasoning, setLiveReasoning] = useState('');
  const [liveTools, setLiveTools] = useState<ToolCall[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [ctx, setCtx] = useState<ContextBundle | null>(null);
  const [tps, setTps] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [atFiles, setAtFiles] = useState<IndexedFile[]>([]);
  const [cost, setCost] = useState(0);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [reasoningDuration, setReasoningDuration] = useState<number | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const turnStart = useRef(0);
  const reasoningStart = useRef(0);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setAttachMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Track how many files the agent changed this chat (for the Changes button).
  useEffect(() => {
    let live = true;
    const load = () => window.nekko.listChanges(sessionId).then((c) => { if (live) setChangeCount(c.length); }).catch(() => {});
    load();
    const off = window.nekko.onChangesUpdated((e) => { if (e.sessionId === sessionId) load(); });
    return () => { live = false; off(); };
  }, [sessionId]);

  useEffect(() => onRunningChange?.(streaming), [streaming, onRunningChange]);

  const refreshCtx = () => {
    window.nekko.previewContext(sessionId, []).then(setCtx).catch(() => setCtx(null));
  };

  // Load the session; seed provider/model from it (or the global defaults).
  useEffect(() => {
    window.nekko.getSession(sessionId).then((s) => {
      setSession(s);
      const st = useStore.getState();
      setProviderId(s?.providerId ?? st.activeProviderId ?? providers[0]?.id ?? null);
      setModelId(s?.autoModel ? AUTO_MODEL_ID : (s?.modelId ?? st.activeModelId ?? null));
    });
    refreshCtx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Models for this pane's provider (independent of other panes).
  useEffect(() => {
    if (!providerId) { setModels([]); return; }
    window.nekko.listModels(providerId).then((m) => {
      setModels(m);
      setModelId((cur) => (cur === AUTO_MODEL_ID || (cur && m.some((x) => x.id === cur)) ? cur : m[0]?.id ?? null));
    }).catch(() => setModels([]));
  }, [providerId]);

  // Per-chat estimated cost.
  useEffect(() => {
    window.nekko.getUsageSummary().then((u) => {
      const s = u.bySession[sessionId];
      setCost(s ? estimateCostUSD(session?.modelId, s.input, s.output) : 0);
    }).catch(() => setCost(0));
  }, [sessionId, session?.modelId, session?.messages.length]);

  // Stream agent events for this session only.
  useEffect(() => {
    const off = window.nekko.onAgentEvent((e: AgentEvent) => {
      if (e.sessionId !== sessionId) return;
      // A turn may start host-side (a queued follow-up, or a task-driven run):
      // reflect it as streaming even though this pane didn't call send().
      if (e.type === 'text' || e.type === 'reasoning' || e.type === 'tool_call') {
        setStreaming(true);
        if (!turnStart.current) { turnStart.current = Date.now(); setMascotMood('thinking'); }
      }
      switch (e.type) {
        case 'text':
          if (reasoningStart.current) {
            setReasoningDuration(Math.round((Date.now() - reasoningStart.current) / 1000));
            reasoningStart.current = 0;
          }
          setLiveText((t) => t + e.delta);
          break;
        case 'reasoning':
          if (!reasoningStart.current) reasoningStart.current = Date.now();
          setLiveReasoning((t) => t + e.delta);
          setThinking(true);
          break;
        case 'usage': {
          const secs = (Date.now() - turnStart.current) / 1000;
          if (secs > 0 && e.outputTokens > 0) setTps(Math.round(e.outputTokens / secs));
          break;
        }
        case 'tool_call':
          if (reasoningStart.current) {
            setReasoningDuration(Math.round((Date.now() - reasoningStart.current) / 1000));
            reasoningStart.current = 0;
          }
          setLiveTools((tc) => [...tc, e.call]);
          break;
        case 'tool_approval_required':
          setApproval({ call: e.call, reason: e.reason, severity: e.severity });
          setMascotMood('thinking');
          break;
        case 'tool_result': setApproval(null); break;
        case 'error':
          useStore.getState().pushToast('error', e.message || 'Something went wrong.');
          endTurn();
          break;
        case 'done':
          if (reasoningStart.current) {
            setReasoningDuration(Math.round((Date.now() - reasoningStart.current) / 1000));
            reasoningStart.current = 0;
          }
          endTurn();
          refreshCtx();
          break;
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, setMascotMood]);

  const endTurn = () => {
    setStreaming(false);
    setLiveText('');
    setLiveReasoning('');
    setLiveTools([]);
    setMascotMood('idle');
    turnStart.current = 0;
    reasoningStart.current = 0;
    window.nekko.getSession(sessionId).then(setSession);
    refreshSessions();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [session?.messages.length, liveText, liveTools.length]);

  const beginTurn = () => {
    setStreaming(true);
    setLiveText('');
    setLiveReasoning('');
    setLiveTools([]);
    setThinking(false);
    setReasoningDuration(null);
    reasoningStart.current = 0;
    turnStart.current = Date.now();
    setMascotMood('thinking');
  };

  // The concrete model to run this turn: the picked one, or, in Auto mode -
  // the best available model for the prompt (favorites break ties).
  const resolveModelId = (text: string): string | null => {
    if (modelId !== AUTO_MODEL_ID) return modelId;
    const favSet = new Set(settings?.favoriteModels ?? []);
    const favs = new Set(models.filter((m) => favSet.has(`${providerId}::${m.id}`)).map((m) => m.id));
    return recommendModel(models, text, favs);
  };

  const send = async (override?: string) => {
    const text = override ?? draft;
    const images = pendingImages;
    if ((!text.trim() && images.length === 0) || !providerId) return;

    // The `goal` skill: `/goal <condition>` starts a long-running background
    // agent that keeps working until the condition is met (not a one-off turn).
    const goalMatch = text.match(/^\/goal\s+([\s\S]+)/i);
    if (goalMatch) {
      const goal = goalMatch[1].trim();
      const useModel = resolveModelId(goal);
      await window.nekko.createTask({
        title: `Goal: ${goal.slice(0, 40)}`,
        kind: 'background',
        keepAlive: 'until',
        condition: goal,
        prompt: `Work autonomously toward this goal: ${goal}`,
        workspaceId: session?.workspaceId,
        providerId,
        modelId: useModel && useModel !== AUTO_MODEL_ID ? useModel : undefined,
        intervalMs: 5 * 60_000,
      });
      useStore.getState().pushToast('success', 'Goal started as a background task, track it in Command Center.');
      if (override === undefined) setDraft('');
      return;
    }

    const useModel = resolveModelId(text);
    if (!useModel) return;
    if (override === undefined) setDraft('');
    if (override === undefined) setPendingImages([]);
    beginTurn();
    setSession((prev) =>
      prev ? {
        ...prev,
        messages: [...prev.messages, {
          id: 'tmp',
          role: 'user',
          content: text,
          ...(images.length ? { images } : {}),
          createdAt: Date.now(),
        }],
      } : prev,
    );
    await window.nekko.sendChat({ sessionId, providerId, modelId: useModel, text, ...(images.length ? { images } : {}) });
  };

  // Queue the draft to run after the current turn (and any earlier queued
  // items). Useful for lining up follow-ups while an agent is working.
  const queueDraft = async () => {
    const text = draft.trim();
    if (!text) return;
    const updated = await window.nekko.queuePrompt(sessionId, text);
    setDraft('');
    if (updated) setSession(updated);
    refreshSessions();
  };

  const removeQueued = async (index: number) => {
    const updated = await window.nekko.dequeuePrompt(sessionId, index);
    if (updated) setSession(updated);
    refreshSessions();
  };

  // A comment/note routed here from the editor or design board: drop it into the
  // draft ("Add to prompt") or send it now ("Run now"). Wait for the provider to
  // be ready (a freshly-opened pane loads it async) before a run-now fires.
  const composerInbox = useStore((s) => s.composerInbox);
  useEffect(() => {
    if (!composerInbox || composerInbox.sessionId !== sessionId) return;
    if (composerInbox.run && (!providerId || streaming)) return;
    const { text, run } = composerInbox;
    useStore.setState({ composerInbox: null });
    if (run) void send(text);
    else { setDraft((d) => (d.trim() ? d + '\n\n' : '') + text); composerRef.current?.focus(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerInbox, sessionId, providerId, streaming]);

  const regenerate = async () => {
    if (streaming || !providerId || !session) return;
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const useModel = resolveModelId(lastUser.content);
    if (!useModel) return;
    beginTurn();
    setSession((prev) => {
      if (!prev) return prev;
      const msgs = [...prev.messages];
      while (msgs.length && msgs[msgs.length - 1].role !== 'user') msgs.pop();
      return { ...prev, messages: msgs };
    });
    await window.nekko.sendChat({
      sessionId,
      providerId,
      modelId: useModel,
      text: lastUser.content,
      ...(lastUser.images?.length ? { images: lastUser.images } : {}),
      regenerate: true,
    });
  };

  const editResend = async (messageId: string, newText: string) => {
    if (!providerId || !newText.trim()) return;
    const useModel = resolveModelId(newText);
    if (!useModel) return;
    await window.nekko.truncateSession(sessionId, messageId);
    beginTurn();
    setSession((prev) => {
      if (!prev) return prev;
      const idx = prev.messages.findIndex((m) => m.id === messageId);
      const kept = idx >= 0 ? prev.messages.slice(0, idx) : prev.messages;
      return { ...prev, messages: [...kept, { id: 'tmp', role: 'user', content: newText, createdAt: Date.now() }] };
    });
    await window.nekko.sendChat({ sessionId, providerId, modelId: useModel, text: newText });
  };

  const exportChat = () => {
    if (!session) return;
    const lines = session.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `## ${m.role === 'user' ? 'You' : 'Nekko'}\n\n${m.content}`);
    const md = `# ${session.title}\n\n${lines.join('\n\n')}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.title || 'chat').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approve = async (okDecision: boolean) => {
    if (!approval) return;
    await window.nekko.approveTool(sessionId, approval.call.id, okDecision);
    setApproval(null);
  };

  const hasProvider = providers.length > 0;
  const slashQuery = draft.startsWith('/') && !draft.includes('\n') ? draft.slice(1).toLowerCase() : null;
  const slashMatches =
    slashQuery !== null ? (settings?.prompts ?? []).filter((p) => p.name.toLowerCase().includes(slashQuery)) : [];
  // Skills (standard agent skills + installed marketplace skills) show in the
  // `/` menu until the user types args.
  const installedSkillDefs = useStore((s) => s.installedSkillDefs);
  const skillMatches = slashQuery !== null && !slashQuery.includes(' ') ? matchSkills(slashQuery, installedSkillDefs) : [];
  const slashMenuOpen = skillMatches.length > 0 || slashMatches.length > 0;

  const atQuery = (draft.match(/(?:^|\s)@([^\s@]*)$/) ?? [])[1] ?? null;
  const atMatches =
    atQuery !== null ? atFiles.filter((f) => f.relPath.toLowerCase().includes(atQuery.toLowerCase())).slice(0, 8) : [];

  useEffect(() => { setAtFiles([]); }, [session?.workspaceId]);
  useEffect(() => {
    if (atQuery !== null && session?.workspaceId && atFiles.length === 0) {
      window.nekko.listFiles(session.workspaceId).then(setAtFiles).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atQuery, session?.workspaceId]);

  const pickFile = async (f: IndexedFile) => {
    if (!session) return;
    const next = Array.from(new Set([...(session.attachedPaths ?? []), f.path]));
    await window.nekko.setSessionAttachments(session.id, next);
    setDraft((d) => d.replace(/(?:^|\s)@([^\s@]*)$/, (full) => (/^\s/.test(full) ? ' ' : '') + '@' + f.relPath + ' '));
    setSession(await window.nekko.getSession(session.id));
    refreshCtx();
    composerRef.current?.focus();
  };

  const addImages = async (files: File[]) => {
    const images = await Promise.all(files.map((file) => readImage(file).catch(() => null)));
    setPendingImages((current) => [...current, ...images.filter((image): image is string => !!image)]);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);
    if (files.length) {
      e.preventDefault();
      void addImages(files);
    }
  };

  const addFiles = async () => {
    const picked = await window.nekko.openFilesDialog();
    if (!session || !picked.length) return;
    const next = Array.from(new Set([...(session.attachedPaths ?? []), ...picked]));
    await window.nekko.setSessionAttachments(session.id, next);
    setSession(await window.nekko.getSession(session.id));
    refreshCtx();
  };

  const favoriteModels = new Set(settings?.favoriteModels ?? []);
  const sortedModels = [...models].sort((a, b) => {
    const fa = favoriteModels.has(`${providerId}::${a.id}`) ? 0 : 1;
    const fb = favoriteModels.has(`${providerId}::${b.id}`) ? 0 : 1;
    return fa - fb;
  });

  const lastMsg = session?.messages[session.messages.length - 1];
  const canRegenerate = !streaming && !!session?.messages.some((m) => m.role === 'assistant') && lastMsg?.role !== 'user';
  const isCloudModel = !LOCAL_KINDS.includes(providers.find((p) => p.id === providerId)?.kind ?? '');
  const modelControls = (
    <>
      <select className="input min-w-0 max-w-[100px] py-0.5 text-[10px] md:max-w-[120px]" value={providerId ?? ''} onChange={(e) => setProviderId(e.target.value)}>
        {!hasProvider && <option value="">No provider</option>}
        {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <select
        className="input min-w-0 max-w-[130px] py-0.5 text-[10px] md:max-w-[170px]"
        value={modelId ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          setModelId(v);
          window.nekko.setSessionOptions(sessionId, { autoModel: v === AUTO_MODEL_ID }).catch(() => {});
        }}
        title={modelId === AUTO_MODEL_ID ? 'Open Paw picks the best model for each message' : undefined}
      >
        {models.length === 0 && <option value="">No models</option>}
        {models.length > 1 && <option value={AUTO_MODEL_ID}>✨ Auto (pick best)</option>}
        {sortedModels.map((m) => (
          <option key={m.id} value={m.id}>{favoriteModels.has(`${providerId}::${m.id}`) ? '★ ' : ''}{m.name}</option>
        ))}
      </select>
      {modelId === AUTO_MODEL_ID && draft.trim() && (() => {
        const picked = resolveModelId(draft);
        const name = models.find((m) => m.id === picked)?.name;
        return name ? <span className="chip shrink-0 text-[10px]" title="Model Auto will use for this message">→ {name}</span> : null;
      })()}
      <button className="btn btn-ghost px-1.5 py-0.5 text-[12px]" onClick={() => setScheduleOpen(true)} title="Automate: schedule, repeat, or run in the background">⚡</button>
    </>
  );

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      <section className="flex min-w-0 w-full flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {session?.parentSessionId && <span className="chip shrink-0 text-[10px]">sub-agent</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {changeCount > 0 && (
              <button
                className="btn btn-ghost px-2 py-1 text-[12px] font-medium text-accent"
                onClick={() => useStore.getState().openDiffPane(sessionId)}
                title="Review the agent's file changes"
              >
                Δ {changeCount}
              </button>
            )}
            {!!session?.messages.length && (
              <button className="btn btn-ghost px-2 py-1" onClick={exportChat} title="Export chat as Markdown"><DownloadIcon /></button>
            )}
            <button className={`btn btn-ghost px-2 py-1 ${ctxOpen ? 'text-accent' : ''}`} onClick={() => setCtxOpen((o) => !o)} title="Toggle context panel"><PanelIcon /></button>
          </div>
        </header>

        <div ref={scrollRef} className="w-full flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
          <div className="mx-auto w-full max-w-3xl space-y-5">
            {!session?.messages.length && !liveText && !liveReasoning && (
              <div className="fade-in mt-12 text-center text-[13px] text-ink-faint">
                {hasProvider ? 'Ask a question or give Nekko a task to run in this project.' : 'Connect a model in Models to get started.'}
              </div>
            )}
            {session?.messages.map((m, i) => (
              <MessageBubble key={m.id + i} message={m} onResend={!streaming && m.role === 'user' && m.id !== 'tmp' ? editResend : undefined} />
            ))}
            {liveReasoning && <ReasoningBlock text={liveReasoning} live={streaming && !liveText} duration={reasoningDuration} />}
            {liveTools.map((t) => <ToolCard key={t.id} call={t} />)}
            {liveText && <MessageBubble message={{ id: 'live', role: 'assistant', content: liveText, createdAt: 0 }} />}
            {streaming && !liveText && !liveReasoning && !liveTools.length && (
              <div className="flex items-center gap-2 text-[13px] text-ink-faint">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Nekko is thinking…
              </div>
            )}
            {canRegenerate && (
              <div className="flex justify-center pt-1">
                <button className="btn btn-outline py-1.5 text-[12px]" onClick={regenerate} title="Re-answer the last message">↻ Regenerate</button>
              </div>
            )}
          </div>
        </div>

        {approval && <ApprovalBar approval={approval} onDecide={approve} />}

        <ChatMetrics bundle={ctx} tps={tps} thinking={thinking} streaming={streaming} cost={cost} controls={modelControls} />

        <div className="border-t border-line px-4 pb-1 pt-3">
          <ChatControls session={session} isCloudModel={isCloudModel} onChange={setSession} />
        </div>

        <div className="px-4 pb-4">
          {(session?.queue?.length ?? 0) > 0 && (
            <div className="mx-auto mb-2 w-full max-w-3xl rounded-xl border border-line bg-surface-2 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-ink-faint">
                📋 Queued · {session!.queue!.length} to run after this
              </div>
              <div className="space-y-1">
                {session!.queue!.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span className="shrink-0 text-[10px] text-ink-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-soft" title={q}>{q}</span>
                    <button className="shrink-0 rounded px-1 text-ink-faint hover:text-red-400" title="Remove from queue" onClick={() => removeQueued(i)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <PromptAnalyzer text={draft} />
          <div className="relative mx-auto flex w-full max-w-3xl items-end gap-2">
            <div ref={attachMenuRef} className="relative shrink-0">
              <button className="btn btn-outline px-2.5" onClick={() => setAttachMenuOpen((open) => !open)} title="Attach photo, file, or folder">+</button>
              {attachMenuOpen && (
                <div className="card absolute bottom-full left-0 z-40 mb-2 w-44 p-1.5 shadow-lg">
                  <button
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-2"
                    onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }}
                  >
                    Photo
                  </button>
                  <button
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-2"
                    onClick={() => { setAttachMenuOpen(false); void addFiles(); }}
                  >
                    File
                  </button>
                  <button
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-surface-2"
                    onClick={() => { setAttachMenuOpen(false); void window.nekko.addWorkspace(); }}
                  >
                    Folder
                  </button>
                </div>
              )}
              <input
                ref={imageInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) void addImages(files);
                  e.target.value = '';
                }}
              />
            </div>
            {pendingImages.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 flex gap-2 overflow-x-auto rounded-xl border border-line bg-surface-2 p-2">
                {pendingImages.map((image, i) => (
                  <div key={`${image.slice(0, 24)}-${i}`} className="group relative shrink-0">
                    <img src={image} alt={`Pending attachment ${i + 1}`} className="h-14 w-14 rounded-lg object-cover" />
                    <button
                      className="absolute -right-1 -top-1 hidden h-4 w-4 rounded-full bg-ink text-[10px] leading-4 text-paper group-hover:block"
                      onClick={() => setPendingImages((current) => current.filter((_, index) => index !== i))}
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {atQuery !== null && session?.workspaceId && (
              <div className="card absolute bottom-full left-0 z-40 mb-2 w-full max-w-md overflow-hidden p-1.5 shadow-lg">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-faint">Attach a file</div>
                {atMatches.length === 0 ? (
                  <div className="px-2.5 py-1.5 text-[11px] text-ink-faint">{atFiles.length === 0 ? 'Index this folder in Projects to mention files.' : 'No matching files.'}</div>
                ) : (
                  atMatches.map((f) => (
                    <button key={f.path} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2" onClick={() => pickFile(f)}>
                      <span className="font-mono text-[12px] text-accent">@{f.relPath}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {slashMenuOpen && (
              <div className="card absolute bottom-full left-0 z-40 mb-2 max-h-80 w-full max-w-md overflow-y-auto p-1.5 shadow-lg">
                {skillMatches.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-faint">Skills</div>
                    {skillMatches.map((sk) => (
                      <button
                        key={sk.id}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2"
                        onClick={() => { setDraft(sk.template); composerRef.current?.focus(); }}
                        title={sk.description}
                      >
                        {sk.highlighted && <span className="text-[12px] text-accent">★</span>}
                        <span className="font-mono text-[12.5px] text-accent">/{sk.name}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-faint">{sk.description}</span>
                      </button>
                    ))}
                  </>
                )}
                {slashMatches.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-faint">Prompts</div>
                    {slashMatches.map((p) => (
                      <button key={p.id} className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-2" onClick={() => { setDraft(p.body); composerRef.current?.focus(); }}>
                        <span className="font-mono text-[12.5px] text-accent">/{p.name}</span>
                        <span className="truncate text-[11px] text-ink-faint">{p.body}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
            <textarea
              ref={composerRef}
              className="input max-h-40 min-h-[44px] resize-none"
              rows={1}
              placeholder={hasProvider ? 'Message Nekko…  (/ for prompts, @ to attach files)' : 'Add a model provider in Models first'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (skillMatches.length === 1 && slashMatches.length === 0) { setDraft(skillMatches[0].template); return; }
                  if (slashMatches.length === 1 && skillMatches.length === 0) { setDraft(slashMatches[0].body); return; }
                  send();
                } else if (e.key === 'Escape' && slashMenuOpen) {
                  setDraft('');
                }
              }}
              disabled={!hasProvider}
            />
            {draft.trim() && hasProvider && (
              <button
                className="btn btn-outline"
                onClick={queueDraft}
                title={streaming ? 'Queue this to run after the current turn' : 'Queue this to run after any queued items'}
              >
                Queue
              </button>
            )}
            {streaming ? (
              <button className="btn btn-outline" onClick={() => window.nekko.abortChat(sessionId)}>Stop</button>
            ) : (
              <button className="btn btn-primary" onClick={() => send()} disabled={(!draft.trim() && pendingImages.length === 0) || !hasProvider}><SendIcon /></button>
            )}
          </div>
        </div>
      </section>

      {ctxOpen && (
        <div className="hidden border-l border-line lg:block" style={{ background: 'var(--paper)' }}>
          <ContextInspector sessionId={sessionId} />
        </div>
      )}

      {scheduleOpen && (
        <ScheduleTaskModal
          workspaceId={session?.workspaceId}
          providerId={providerId ?? undefined}
          modelId={modelId && modelId !== AUTO_MODEL_ID ? modelId : undefined}
          initialPrompt={draft.trim() || undefined}
          onClose={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}

/** Claude-Code-style thinking box: quiet, left-accent rule, collapsible. */
function ReasoningBlock({ text, live, duration }: { text: string; live: boolean; duration: number | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!live) setOpen(false); }, [live]);
  return (
    <div className="fade-in thinking-box overflow-hidden">
      <button className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-ink-soft hover:text-ink" onClick={() => setOpen((o) => !o)}>
        <span className={live ? 'h-2 w-2 animate-pulse rounded-full' : 'h-2 w-2 rounded-full'} style={{ background: live ? 'var(--accent)' : 'var(--ink-faint)' }} />
        {live ? 'Thinking…' : duration != null ? `Thought for ${duration}s` : 'Thought process'}
        <span className="ml-auto text-[10px] text-ink-faint">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap border-t border-line px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-faint">
          {text}
          {live && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse align-middle" style={{ background: 'var(--accent)' }} />}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, onResend }: { message: ChatMessage; onResend?: (id: string, text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  if (message.role === 'tool') return null;
  const isUser = message.role === 'user';
  const copy = () => {
    navigator.clipboard?.writeText(message.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
  };

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%]">
          <textarea className="input max-h-48 min-h-[60px] resize-none text-[14px]" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
          <div className="mt-1.5 flex justify-end gap-2">
            <button className="btn btn-ghost py-1 text-[12px]" onClick={() => { setEditing(false); setDraft(message.content); }}>Cancel</button>
            <button className="btn btn-primary py-1 text-[12px]" onClick={() => { setEditing(false); onResend?.(message.id, draft); }}>Save &amp; send</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group fade-in flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
        {isUser && message.images?.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.images.map((image, i) => (
              <img key={`${image.slice(0, 24)}-${i}`} src={image} alt={`Attached image ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
            ))}
          </div>
        ) : null}
        {!isUser && message.reasoning && (
          <ReasoningBlock text={message.reasoning} live={false} duration={message.reasoningSeconds ?? null} />
        )}
        {isUser ? <p className="whitespace-pre-wrap text-[14px]">{message.content}</p> : <Markdown text={message.content} />}
        {message.toolCalls?.map((c) => <ToolCard key={c.id} call={c} />)}
        {message.content && (
          <div className={`mt-1.5 flex gap-3 text-[10.5px] opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? 'justify-end text-white/80' : 'text-ink-faint'}`}>
            <button onClick={copy} title="Copy message" className={isUser ? 'hover:text-white' : 'hover:text-ink'}>{copied ? '✓ copied' : 'Copy'}</button>
            {onResend && <button onClick={() => { setDraft(message.content); setEditing(true); }} title="Edit & resend" className="hover:text-white">Edit</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ call }: { call: ToolCall }) {
  const isSpawn = call.name === 'spawn_agent';
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-xl border border-line p-2.5 font-mono text-[12px]" style={{ background: 'var(--surface-2)' }}>
      <button className="flex w-full items-center gap-2 text-left text-ink-soft" onClick={() => setOpen((value) => !value)}>
        <ShieldIcon className="h-3.5 w-3.5" />
        <span className="font-semibold">{isSpawn ? '🤖 ' : ''}Used <span className="font-mono">{call.name}</span> tool</span>
        <span className="ml-auto text-[10px] text-ink-faint">{open ? '▾' : '▸'}</span>
      </button>
      {open && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap border-t border-line pt-1 text-ink-faint">{JSON.stringify(call.input, null, 2)}</pre>}
    </div>
  );
}

function ApprovalBar({ approval, onDecide }: { approval: PendingApproval; onDecide: (ok: boolean) => void }) {
  const color = approval.severity === 'high' ? '#e0574a' : approval.severity === 'medium' ? '#e0a44a' : '#8a8f98';
  return (
    <div className="border-t border-line px-5 py-3" style={{ background: 'var(--surface-2)' }}>
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <ShieldIcon className="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">Approval required</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: color }}>{approval.severity}</span>
            <span className="text-[12px] text-ink-faint">{approval.reason}</span>
          </div>
          <code className="mt-0.5 block truncate font-mono text-[12px] text-ink-soft">
            {String((approval.call.input as Record<string, unknown>).command ?? JSON.stringify(approval.call.input))}
          </code>
        </div>
        <button className="btn btn-outline" onClick={() => onDecide(false)}>Deny</button>
        <button className="btn btn-primary" onClick={() => onDecide(true)}>Approve</button>
      </div>
    </div>
  );
}
