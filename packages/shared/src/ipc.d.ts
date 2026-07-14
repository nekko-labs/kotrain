/** IPC channel contracts between renderer and main. */
import type { AppSettings, UsageSummary } from './settings.js';
import type { ProviderConfig, ModelInfo } from './models.js';
import type { Session, SendOptions, AgentEvent } from './chat.js';
import type { TerminalInfo, TerminalSnapshot, ShellOption } from './terminal.js';
import type { ContextBundle } from './context.js';
import type { MemoryEntry, MemoryScope } from './memory.js';
import type { WorkspaceFolder, IndexStatus, SearchHit, IndexedFile } from './workspace.js';
import type { DirEntry, FileContent, FileChange, LineComment } from './files.js';
import type { DesignBoard, DesignPage } from './design.js';
import type { AutomationTask, NewTask } from './tasks.js';
import type { ConnectorConfig, ConnectorKind, ConnectorResource } from './connectors.js';
import type { GuardrailRule } from './guardrails.js';
import type { AppInfo, UpdateInfo } from './update.js';
/** Invoke (request/response) channels. */
export declare const IpcChannels: {
    readonly settingsGet: "settings:get";
    readonly settingsUpdate: "settings:update";
    readonly providersList: "providers:list";
    readonly providersSave: "providers:save";
    readonly providersRemove: "providers:remove";
    readonly providersDiscover: "providers:discover";
    readonly providersTest: "providers:test";
    readonly providersTestConfig: "providers:testConfig";
    readonly modelsList: "models:list";
    readonly modelPull: "model:pull";
    readonly modelLoad: "model:load";
    readonly modelUnload: "model:unload";
    readonly sessionsList: "sessions:list";
    readonly sessionCreate: "session:create";
    readonly sessionGet: "session:get";
    readonly sessionDelete: "session:delete";
    readonly sessionSetWorkspace: "session:setWorkspace";
    readonly sessionSetSupportingWorkspaces: "session:setSupportingWorkspaces";
    readonly chatSend: "chat:send";
    readonly chatAbort: "chat:abort";
    readonly chatQueue: "chat:queue";
    readonly chatDequeue: "chat:dequeue";
    readonly toolApprove: "tool:approve";
    readonly terminalsList: "terminals:list";
    readonly terminalShells: "terminal:shells";
    readonly terminalCreate: "terminal:create";
    readonly terminalSnapshot: "terminal:snapshot";
    readonly terminalUpdate: "terminal:update";
    readonly terminalWrite: "terminal:write";
    readonly terminalResize: "terminal:resize";
    readonly terminalRun: "terminal:run";
    readonly terminalSignal: "terminal:signal";
    readonly terminalClose: "terminal:close";
    readonly contextPreview: "context:preview";
    readonly contextToggle: "context:toggle";
    readonly contextSetPrefs: "context:setPrefs";
    readonly sessionSetAttachments: "session:setAttachments";
    readonly specBuild: "spec:build";
    readonly specBuildDoc: "spec:buildDoc";
    readonly specReadDocs: "spec:readDocs";
    readonly specSetMethodology: "spec:setMethodology";
    readonly specToggleTask: "spec:toggleTask";
    readonly specSetLinked: "spec:setLinked";
    readonly specPath: "spec:path";
    readonly sessionSetOptions: "session:setOptions";
    readonly sessionTruncate: "session:truncate";
    readonly sessionsClear: "sessions:clear";
    readonly settingsReset: "settings:reset";
    readonly dataWipe: "data:wipe";
    readonly toolsList: "tools:list";
    readonly dialogOpenFiles: "dialog:openFiles";
    readonly openPath: "shell:openPath";
    readonly memoryList: "memory:list";
    readonly memorySave: "memory:save";
    readonly memoryDelete: "memory:delete";
    readonly workspaceList: "workspace:list";
    readonly workspaceAdd: "workspace:add";
    readonly workspaceAddByPath: "workspace:addByPath";
    readonly workspaceRemove: "workspace:remove";
    readonly workspaceIndex: "workspace:index";
    readonly workspaceIndexStatus: "workspace:indexStatus";
    readonly workspaceSearch: "workspace:search";
    readonly workspaceFiles: "workspace:files";
    readonly fileRead: "file:read";
    readonly fileWrite: "file:write";
    readonly dirList: "dir:list";
    readonly changesList: "changes:list";
    readonly changeAccept: "changes:accept";
    readonly changeAcceptAll: "changes:acceptAll";
    readonly commentsList: "comments:list";
    readonly commentAdd: "comment:add";
    readonly commentResolve: "comment:resolve";
    readonly designGet: "design:get";
    readonly designAddPage: "design:addPage";
    readonly designUpdatePage: "design:updatePage";
    readonly designRemovePage: "design:removePage";
    readonly designAddNote: "design:addNote";
    readonly designResolveNote: "design:resolveNote";
    readonly skillsInstalled: "skills:installed";
    readonly skillsTargets: "skills:targets";
    readonly skillInstall: "skill:install";
    readonly skillUninstall: "skill:uninstall";
    readonly dojoCatalog: "dojo:catalog";
    readonly dojoSkillMd: "dojo:skillMd";
    readonly tasksList: "tasks:list";
    readonly taskCreate: "task:create";
    readonly taskUpdate: "task:update";
    readonly taskDelete: "task:delete";
    readonly taskRunNow: "task:runNow";
    readonly connectorsList: "connectors:list";
    readonly connectorConnect: "connector:connect";
    readonly connectorDisconnect: "connector:disconnect";
    readonly connectorFetch: "connector:fetch";
    readonly guardrailsClassify: "guardrails:classify";
    readonly usageSummary: "usage:summary";
    readonly remoteEnable: "remote:enable";
    readonly remoteDisable: "remote:disable";
    readonly remoteStatus: "remote:status";
    readonly appInfo: "app:info";
    readonly mcpStatus: "mcp:status";
    readonly mcpNekko: "mcp:nekko";
    readonly updateCheck: "update:check";
    readonly updateDownload: "update:download";
    readonly updateInstall: "update:install";
    readonly dialogOpenFolder: "dialog:openFolder";
};
/** Push (main → renderer) channels. */
export declare const IpcEvents: {
    readonly agentEvent: "agent:event";
    readonly indexProgress: "index:progress";
    readonly updateEvent: "update:event";
    readonly terminalEvent: "terminal:event";
    readonly changesUpdated: "changes:updated";
    readonly tasksUpdated: "tasks:updated";
};
/** The typed API the preload bridge exposes as window.nekko. */
export interface NekkoApi {
    getSettings(): Promise<AppSettings>;
    updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
    listProviders(): Promise<ProviderConfig[]>;
    saveProvider(p: ProviderConfig): Promise<ProviderConfig[]>;
    removeProvider(id: string): Promise<ProviderConfig[]>;
    discoverProviders(): Promise<ProviderConfig[]>;
    testProvider(id: string): Promise<{
        ok: boolean;
        message: string;
    }>;
    /** Test an unsaved provider config (used by the add form before saving). */
    testProviderConfig(cfg: ProviderConfig): Promise<{
        ok: boolean;
        message: string;
    }>;
    listModels(providerId: string): Promise<ModelInfo[]>;
    pullModel(providerId: string, model: string): Promise<{
        ok: boolean;
        message: string;
    }>;
    loadModel(providerId: string, model: string): Promise<{
        ok: boolean;
    }>;
    unloadModel(providerId: string, model: string): Promise<{
        ok: boolean;
    }>;
    listSessions(): Promise<Session[]>;
    createSession(workspaceId?: string): Promise<Session>;
    getSession(id: string): Promise<Session | null>;
    deleteSession(id: string): Promise<void>;
    setSessionWorkspace(sessionId: string, workspaceId?: string): Promise<Session | null>;
    setSessionSupportingWorkspaces(sessionId: string, workspaceIds: string[]): Promise<Session | null>;
    setSessionAttachments(sessionId: string, paths: string[]): Promise<Session | null>;
    sendChat(opts: SendOptions): Promise<void>;
    abortChat(sessionId: string): Promise<void>;
    /** Append a prompt to a chat's run-queue (runs when the current turn ends). */
    queuePrompt(sessionId: string, text: string): Promise<Session | null>;
    /** Remove a queued prompt by index. */
    dequeuePrompt(sessionId: string, index: number): Promise<Session | null>;
    approveTool(sessionId: string, toolCallId: string, approved: boolean): Promise<void>;
    /** Live terminal sessions (in-memory; they don't persist across restarts). */
    listTerminals(): Promise<TerminalInfo[]>;
    /** Shells the host detected as available to launch. */
    listShells(): Promise<ShellOption[]>;
    /** Spawn a PTY-backed shell, optionally scoped to a project / cwd / shell. */
    createTerminal(opts?: {
        workspaceId?: string;
        cwd?: string;
        title?: string;
        shell?: string;
        cols?: number;
        rows?: number;
    }): Promise<TerminalInfo>;
    /** Fetch current info + retained raw scrollback (for reattaching a renderer). */
    terminalSnapshot(id: string): Promise<TerminalSnapshot | null>;
    /** Update a terminal's project/order (sidebar drag-and-drop). */
    updateTerminal(id: string, patch: {
        workspaceId?: string | null;
        order?: number;
        title?: string;
    }): Promise<void>;
    /** Write raw input (keystrokes) to the PTY. */
    writeTerminal(id: string, data: string): Promise<void>;
    /** Tell the PTY its new viewport size so the shell reflows. */
    resizeTerminal(id: string, cols: number, rows: number): Promise<void>;
    /** Convenience: write a command line followed by Enter. */
    runInTerminal(id: string, command: string): Promise<void>;
    /** Send a control signal (e.g. interrupt → Ctrl-C). */
    signalTerminal(id: string, signal: 'interrupt'): Promise<void>;
    /** Kill the shell and forget the terminal. */
    closeTerminal(id: string): Promise<void>;
    previewContext(sessionId: string, attachedPaths: string[]): Promise<ContextBundle>;
    toggleContextItem(sessionId: string, itemId: string, included: boolean, pinned: boolean): Promise<ContextBundle>;
    setContextPrefs(sessionId: string, prefs: import('./chat.js').ContextPrefs): Promise<void>;
    /** Build/refresh the primary spec doc in the chat's workspace from the conversation. */
    buildSpec(sessionId: string): Promise<{
        ok: boolean;
        path?: string;
        message?: string;
    }>;
    /** Build/refresh one artifact (by id) of the chat's spec methodology. */
    buildSpecDoc(sessionId: string, docId?: string, workspaceId?: string): Promise<{
        ok: boolean;
        path?: string;
        docId?: string;
        message?: string;
    }>;
    /** Read the live status of every artifact in the chat's spec methodology. */
    readSpecDocs(sessionId: string, workspaceId?: string): Promise<{
        methodologyId: string;
        docs: import('./spec.js').SpecDocStatus[];
    }>;
    /** Set the spec methodology for a chat. */
    setSpecMethodology(sessionId: string, methodologyId: string): Promise<void>;
    /** Toggle a checklist item in the chat's tasks artifact. */
    toggleSpecTask(sessionId: string, lineIndex: number, workspaceId?: string): Promise<{
        ok: boolean;
        message?: string;
    }>;
    setSpecLinked(sessionId: string, linked: boolean): Promise<Session | null>;
    specPath(sessionId: string): Promise<string | null>;
    setSessionOptions(id: string, patch: Partial<Pick<Session, 'title' | 'pinned' | 'tags' | 'order' | 'mode' | 'disabledTools' | 'offline' | 'incognito' | 'autoModel'>>): Promise<Session | null>;
    truncateSession(id: string, messageId: string): Promise<Session | null>;
    /** Delete chats within a window; returns how many were removed. */
    clearSessions(scope: import('./chat.js').ChatClearScope): Promise<number>;
    /** Reset all settings to defaults (keeps chats). */
    resetSettings(): Promise<AppSettings>;
    /** Delete everything: chats, settings, memory, and usage. */
    wipeAllData(): Promise<AppSettings>;
    listTools(): Promise<Array<{
        name: string;
        description: string;
    }>>;
    /** Open a native file picker (desktop) → chosen paths; browser → prompt. */
    openFilesDialog(): Promise<string[]>;
    /** Reveal/open a path with the OS (desktop) or a URL (web). */
    openPath(path: string): Promise<void>;
    listMemory(scope: MemoryScope, workspaceId?: string): Promise<MemoryEntry[]>;
    saveMemory(entry: MemoryEntry): Promise<MemoryEntry[]>;
    deleteMemory(id: string): Promise<void>;
    listWorkspaces(): Promise<WorkspaceFolder[]>;
    addWorkspace(): Promise<WorkspaceFolder[]>;
    addWorkspaceByPath(path: string): Promise<WorkspaceFolder[]>;
    removeWorkspace(id: string): Promise<WorkspaceFolder[]>;
    indexWorkspace(id: string): Promise<IndexStatus>;
    getIndexStatus(id: string): Promise<IndexStatus | null>;
    searchWorkspace(id: string, query: string): Promise<SearchHit[]>;
    listFiles(id: string): Promise<IndexedFile[]>;
    /** Read a file as text (for the in-app viewer/editor). */
    readFile(path: string): Promise<FileContent>;
    /** Write text to a file (in-app editor save). */
    writeFile(path: string, content: string): Promise<void>;
    /** List a directory's immediate entries (file explorer). */
    listDir(path: string): Promise<DirEntry[]>;
    /** Files the agent changed this session (diff/approve). */
    listChanges(sessionId: string): Promise<FileChange[]>;
    /** Keep a file's changes, stop tracking it. */
    acceptChange(sessionId: string, path: string): Promise<void>;
    /** Keep all of a session's changes. */
    acceptAllChanges(sessionId: string): Promise<void>;
    /** Inline editor comments on a file (gutter "+" annotations the agent picks up). */
    listComments(path: string): Promise<LineComment[]>;
    addComment(path: string, line: number, lineText: string, comment: string): Promise<LineComment[]>;
    resolveComment(path: string, id: string): Promise<LineComment[]>;
    /** Design board: a workspace's UI page snapshots + persistent notes. */
    getDesignBoard(workspaceId: string): Promise<DesignBoard>;
    addDesignPage(workspaceId: string, label: string, url: string): Promise<DesignBoard>;
    updateDesignPage(workspaceId: string, pageId: string, patch: Partial<Pick<DesignPage, 'label' | 'url'>>): Promise<DesignBoard>;
    removeDesignPage(workspaceId: string, pageId: string): Promise<DesignBoard>;
    addDesignNote(workspaceId: string, pageId: string, text: string): Promise<DesignBoard>;
    resolveDesignNote(workspaceId: string, pageId: string, noteId: string): Promise<DesignBoard>;
    /** Skills marketplace: what's installed, where installs can go, install/remove. */
    listInstalledSkills(): Promise<import('./skills-market.js').InstalledSkillRecord[]>;
    skillTargets(): Promise<import('./skills-market.js').InstallTargetInfo[]>;
    installSkill(skillId: string, target: import('./skills-market.js').InstallTarget, payload?: import('./skills-market.js').MarketplaceSkill): Promise<{
        ok: boolean;
        message?: string;
        installed: import('./skills-market.js').InstalledSkillRecord[];
    }>;
    uninstallSkill(skillId: string, target: import('./skills-market.js').InstallTarget): Promise<import('./skills-market.js').InstalledSkillRecord[]>;
    /** Nekko Dojo skills hub (optional integration): catalog + SKILL.md fetch. */
    dojoCatalog(refresh?: boolean): Promise<import('./dojo.js').DojoCatalog>;
    dojoSkillMd(slug: string): Promise<string | null>;
    /** Automation tasks: scheduled, recurring, and long-running background agents. */
    listTasks(): Promise<AutomationTask[]>;
    createTask(task: NewTask): Promise<AutomationTask[]>;
    updateTask(id: string, patch: Partial<AutomationTask>): Promise<AutomationTask[]>;
    deleteTask(id: string): Promise<AutomationTask[]>;
    runTaskNow(id: string): Promise<void>;
    listConnectors(): Promise<ConnectorConfig[]>;
    connectConnector(kind: ConnectorKind, token: string, settings?: Record<string, string>): Promise<ConnectorConfig[]>;
    disconnectConnector(kind: ConnectorKind): Promise<ConnectorConfig[]>;
    fetchConnector(kind: ConnectorKind, query?: string): Promise<ConnectorResource[]>;
    classifyCommand(command: string): Promise<import('./guardrails.js').GuardrailDecision>;
    saveGuardrail(rule: GuardrailRule): Promise<GuardrailRule[]>;
    getUsageSummary(): Promise<UsageSummary>;
    enableRemote(relayUrl: string): Promise<import('./remote.js').RemoteStatus>;
    disableRemote(): Promise<import('./remote.js').RemoteStatus>;
    getRemoteStatus(): Promise<import('./remote.js').RemoteStatus>;
    /** Running version + edition. */
    getAppInfo(): Promise<AppInfo>;
    /** Connect configured MCP servers and return their status + tools. */
    getMcpStatus(): Promise<import('./mcp.js').McpServerStatus[]>;
    /** Probe for a local NekkoMCP daemon (nekko-mcpd) and return its gateway info. */
    detectNekkoMcp(): Promise<import('./mcp.js').NekkoMcpInfo | null>;
    /** Register this device's push token with the relay (mobile/relay only; no-op elsewhere). */
    registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
    /** Check for a newer version (desktop: GitHub feed; web: server version). */
    checkForUpdates(): Promise<UpdateInfo>;
    /** Download the available update (desktop only; web resolves immediately). */
    downloadUpdate(): Promise<UpdateInfo>;
    /** Install + relaunch (desktop) or reload the page (web). */
    quitAndInstall(): Promise<void>;
    onAgentEvent(cb: (e: AgentEvent) => void): () => void;
    onIndexProgress(cb: (s: IndexStatus) => void): () => void;
    onUpdateEvent(cb: (u: UpdateInfo) => void): () => void;
    onTerminalEvent(cb: (e: import('./terminal.js').TerminalEvent) => void): () => void;
    /** Fires when a session's tracked file changes shift (after an agent edit/accept). */
    onChangesUpdated(cb: (e: {
        sessionId: string;
    }) => void): () => void;
    /** Fires when the automation-task list changes (created/updated/fired/deleted). */
    onTasksUpdated(cb: (tasks: AutomationTask[]) => void): () => void;
}
