# Open Paw — Plan

> **How.** Architecture, stack, and conventions for the wave described in
> [spec.md](spec.md). Concrete checklist in [tasks.md](tasks.md).

## Architecture recap

- **Monorepo**: `packages/shared` (types + IPC contract), `packages/core` (agent loop +
  tools), `packages/host` (backend: settings, sessions, terminals, files), and apps
  (`desktop` = Electron, `server`/`cloud` = web editions, `cli`, `relay`, `mobile`).
- **Transport-agnostic host**: every edition wraps the same `Host`. Renderer talks to it
  via `window.nekko` — backed by Electron IPC (desktop) or WebSocket/HTTP (web).
- **Adding any renderer↔host capability** means touching, in order: `shared/ipc.ts`
  (channel + `NekkoApi` type) → `host` impl + `host.ts` interface → `dispatch.ts` →
  `preload/index.ts` (Electron) → `web-client.ts` (web). Keep all five in sync.
- **Workbench panes**: `store.ts` holds `groups: WbGroup[]`, each a column of tabbed
  `WbPane`s. `WbPane.kind` is currently `'chat' | 'terminal'`; `WorkbenchView.tsx` routes
  each kind to a component.

## Feature plans

### 1 + 2. File / browser panes (and the dead-click fix)
- **New pane kinds**: extend `WbPane.kind` to `'chat' | 'terminal' | 'file' | 'browser' | 'diff'`.
  - `WbPane.refId` holds the file path (file/diff) or URL (browser).
- **Store openers**: `openFilePane(path)`, `openBrowserPane(url?)`, `openDiffPane(sessionId)` —
  mirror `openChatPane` (locate-or-create, focus). The diff pane is session-level (reviews
  all of a session's changed files), opened from a `Δ N` button in the chat header.
- **`FilePane` component**: reads the file via new IPC; `.md` → toggle between rendered
  (`Markdown.tsx`) and source; other text → editable `<textarea>` (mono). Save button +
  Ctrl/Cmd-S → `writeFile`. Dirty indicator. Binary/oversized files show a notice.
- **`BrowserPane` component**: `<webview>` with a URL bar (go / back / forward / reload /
  open-external). Requires `webviewTag: true` in the main `webPreferences`.
- **SpecPanel fix**: change the ↗/row click from `window.nekko.openPath(path)` to
  `useStore.getState().openFilePane(path)`; keep an explicit "reveal in OS" affordance.
- **File IPC** (new): `readFile(path) → {content, truncated, binary}`,
  `writeFile(path, content)`, `listDir(path) → DirEntry[]`. Host implements with `fs`,
  honoring the existing sandbox/jail checks where applicable.

### 3. Hoverable Context Inspector
- Reuse the existing **CSS group-hover tooltip pattern** from `ChatMetrics.tsx` (no new
  dep): a `.group` wrapper + a `.group-hover:block` popover.
- Add a per-source explanation map (system / memory / attached-file / guideline /
  connector / index-snippet) and attach an info popover to each section header in
  `ContextInspector.tsx`.

### 4. File explorer
- **`FileTree` component** in the workbench sidebar (collapsible section per project),
  lazy-loading children via `listDir` on expand.
- **`fileIcons.ts`**: a `{ extension/filename → {color, glyph} }` table + a `FileIcon`
  component (single tinted page glyph; folder open/closed). Colors from the
  Linguist/Material palette (see spec research).
- Click a file → `openFilePane`. Right-click later for rename/new (deferred).

### 5. Diff & approval
- **Host change-tracking** (`packages/host/src/changes.ts`): keyed by sessionId, record
  `{ path, original }` the first time `write_file`/`edit_file` touches a path in a session
  (hook into `tools.ts`). Expose:
  - `listChanges(sessionId) → ChangeEntry[]` (`{path, original, current, status}`)
  - `revertChange(sessionId, path, lines?)` — write original (or per-line merge) back
  - `acceptChange(sessionId, path)` / `acceptAll` — drop from the pending set
- **`DiffPane` / Changes panel** (renderer): compute a line diff client-side (small LCS;
  no dep), render added/removed lines with per-line keep/revert checkboxes, a per-file
  Approve/Revert, and Approve-all / Revert-all. Devin-style: changed lines grouped by
  file, accept/reject at line · file · all.
- Emit a `changesUpdated` event so the panel refreshes as the agent edits.

### 6. Prompt analyzer
- **`promptAnalysis.ts`** (pure, renderer-side, no LLM): given the draft text, return
  `{ parts: Part[], findings: Finding[], score: 'A'..'F', model: Recommendation }`.
  - **Part detection**: role / task / context / examples / output-format / constraints /
    reasoning / tone / variables (regex + structural — see spec research Deliverable A).
  - **Lint rules** (severity critical/warn/info): vague terms, weak/passive verbs, missing
    role, missing output format, no examples for extraction tasks, ambiguous pronouns,
    too long/short, long sentences, filler/redundancy, conflicting instructions, secret
    leak, PII (see spec research Deliverable B).
  - **Model hint**: multi-step reasoning + large context → frontier model; short single-shot
    → fast/cheap model.
- **UI** in the composer (`ChatPane.tsx` bottom area): a compact bar showing the score +
  part checklist (role ✓, format ✗…), expandable to a grouped findings list; inline
  underlines over flagged spans in an overlay aligned to the textarea. Toggleable.

## Conventions
- Match existing style: Tailwind + CSS vars (`--ink`, `--surface-2`, `--accent`…), small
  zero-dep components, `title=`/group-hover tooltips, `window.nekko` for all host calls.
- New deps only when unavoidable; prefer in-repo implementations (diff, prompt analysis,
  icons all done without new deps).
- Every change keeps **all workspaces typechecking** (`npm run typecheck`) and the desktop
  **building** (`npm run build`). Commit per feature.

## Risks / verification
- The GUI can't be exercised in this environment; changes are verified by typecheck +
  build. Interactive surfaces (webview, drag, diff, analyzer overlay) need a hands-on pass.
- `<webview>` is discouraged by Electron; acceptable for v1, revisit `WebContentsView`.
