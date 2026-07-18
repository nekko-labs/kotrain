# Kotrain CLI + MCP server (`kotrain`)

Drive your local Kotrain agent from the terminal, or expose it to other tools
(Claude Code, Codex, any MCP client) so they can trigger agents, make chat
requests, spin up sessions, and read status. Runs the same engine (`createHost`)
in-process against your data dir.

```bash
npm run build -w @kotrain/cli
node apps/cli/dist/index.js status        # or: npm link, then `kotrain status`
```

### Where it connects

- **Local (default)**: runs the engine in-process against a data dir: `~/.kotrain`
  (shared with the web/Docker edition). Set `KOTRAIN_DATA_DIR` to the desktop app's
  dir to share that instead (`%APPDATA%/Kotrain/kotrain` on Windows,
  `~/Library/Application Support/Kotrain/kotrain` on macOS).
- **Remote**: pass `--url http://host:1440` (or `KOTRAIN_URL`) to talk to a
  **running** Kotrain server over HTTP+WS, your live instance, a Docker
  container, or another machine. Add `--token` (or `KOTRAIN_TOKEN`) if it's secured.

Add `--json` to `status`/`sessions` for machine-readable output.

## CLI

```bash
kotrain status                          # providers, model, workspaces, sessions, relay
kotrain sessions                        # list chats
kotrain chat "summarize README.md" \    # run an agent turn (streams the reply)
  --workspace <id> --new
kotrain chat "and now add tests" --session <id>
```

`chat` auto-approves tool calls (it's your machine, invoked explicitly).

## MCP server

```bash
kotrain mcp        # JSON-RPC 2.0 over stdio
```

Register it in **Claude Code**:

```bash
claude mcp add kotrain -- node /abs/path/kotrain/apps/cli/dist/index.js mcp
# (or once published/linked: claude mcp add kotrain -- kotrain mcp)
```

Or in any MCP client config:

```json
{ "mcpServers": { "kotrain": { "command": "kotrain", "args": ["mcp"] } } }
```

### Tools exposed

| Tool | What |
| --- | --- |
| `open_paw_chat` | Run an agent turn (reads/edits/runs in your workspace); returns the reply. Omit `sessionId` to start fresh. |
| `open_paw_list_sessions` | List sessions. |
| `open_paw_new_session` | Create a session, returns its id. |
| `open_paw_get_session` | Get a transcript. |
| `open_paw_status` | Providers, default model, workspaces, session count, relay status. |
| `open_paw_train_start` | Start a **training run**: a local data-scientist agent benchmarks candidates, fine-tunes, evaluates, and reports experiments with scores. |
| `open_paw_train_status` | Experiment tree + leader for one run (or a summary of all runs). |
| `open_paw_train_hint` | Queue guidance the agent folds into its next experiments. |
| `open_paw_train_stop` | Stop a run. |

So an MCP client can say "train me a model for X": start a run whose goal is
to benchmark existing models for X (reported as scored experiments, i.e. the
recommendation step) and then fine-tune to beat the best of them.

**Swarms**: call `open_paw_new_session` a few times and fan out `open_paw_chat`
across the session ids, each is an independent agent driving your local model.
