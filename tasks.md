# Open Paw — Tasks

> Execution checklist. Human-readable items first; technical notes as sub-bullets.
> Check items off as they ship. See [spec.md](spec.md) / [plan.md](plan.md).

## Wave: IDE surfaces + prompt analyzer  ✅ shipped

### Foundation — let the app read & write files
- [x] Add the ability for the app to read a file, save a file, and list a folder
  - `readFile`/`writeFile`/`listDir` IPC wired through shared/host(`files.ts`)/dispatch/preload/web-client
  - `readFile` returns `{ content, truncated, binary }` (1 MB cap, NUL-byte binary detect); `listDir` dirs-first

### Fix — clicking a spec/plan/tasks doc opens it in the app
- [x] Clicking a doc (or its ↗) opens it in a built-in viewer pane, not the OS
  - `SpecPanel.tsx` ↗/row → `openFilePane(path)`; FilePane keeps a "reveal in OS" button

### Built-in viewer: markdown + code + browser
- [x] Open a markdown or code file in a pane and read or edit it — `FilePane.tsx`
  - `.md` rendered (Source/Preview toggle); other text → mono editor; Save + Cmd/Ctrl-S; dirty dot; binary/large notice
- [x] Open an integrated browser pane with a URL bar — `BrowserPane.tsx`
  - `<webview>` + back/forward/reload/open-external; `webviewTag` enabled in main window

### Context inspector explains itself on hover
- [x] Hovering a section/source shows what it is and how to control it
  - `ContextInspector.tsx` `InfoHint` (group-hover popover) on every section + source category

### VS Code–style file/folder explorer
- [x] A collapsible project file tree with file-type icons — `FileTree.tsx` (`ProjectFiles`)
  - lazy children via `listDir`; `fileIcons.tsx` color-tinted chips (Linguist/Material palette)
- [x] Clicking a file opens it; edits save in-app (via FilePane)

### Diff & approval (Devin-style)
- [x] See every file the agent changed this session in one place
  - host `changes.ts` snapshots original on first `write_file`/`edit_file`; `Δ N` button in chat header; live `changesUpdated` event
- [x] Approve or revert per line, per file, or all at once — `DiffPane.tsx`
  - client-side LCS line diff; tick lines → Revert selected; Keep/Revert file; Keep all/Revert all

### Prompt analyzer in the composer
- [x] As you type, identify the parts of your prompt and flag weak spots
  - `promptAnalysis.ts` (pure, no LLM) + `PromptAnalyzer.tsx`: A–F grade, part checklist, inline wavy underlines, suggestions
- [x] Suggests a model based on the prompt (complexity/context heuristic → fast/balanced/frontier)
- [ ] (Later) opt-in "Improve prompt" button → LLM rewrite with before/after diff — deferred

## Verification status
- All eight workspaces typecheck (`npm run typecheck`); desktop builds (`npm run build`).
- NOT yet exercised in the running GUI (couldn't launch Electron here). Needs a hands-on pass:
  webview browsing, file edit+save, the file tree, the diff line-revert math, and the analyzer overlay.

## Follow-ups / deferred
- "Improve prompt" LLM escalation (before/after diff).
- "Open in external terminal" launcher (from the earlier terminal wave).
- Browser pane on `WebContentsView` instead of `<webview>` (Electron's recommendation).
- File tree: right-click new/rename/delete; markdown scroll-sync; live underline overlay in the textarea.
