<div align="center">

# 🐾 Nekko Paw

**Local-first AI coding & cowork — chat, cowork, and code in one calm window.**

Open source · MIT · first-class support for the models you run yourself.

</div>

---

Nekko Paw is a desktop assistant (Electron + React) that unifies conversation and
coding into a single surface. Its headline feature is **first-class local model
support** — point it at Ollama, LM Studio, or vLLM in one click — alongside every
major cloud provider. It ships with a context-provenance inspector, default
guardrails for risky commands, an out-of-the-box sandbox, multi-folder code
indexing, memory management, connectors, and an 8-bit cat mascot that makes
biscuits while the model thinks.

> **Verified working** end-to-end against a live LM Studio server (`google/gemma-4-31b-qat`):
> connect, model listing, streaming, **reasoning models**, and the full tool-calling
> agent loop (single- and multi-step). Run `node scripts/itest-local.mjs <baseUrl> <model>`
> to check your own server.

![Nekko Paw — unified chat with the Context Inspector](docs/screenshots/chat.png)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/models.png" alt="Models — local + cloud providers with usage analytics" /></td>
    <td width="50%"><img src="docs/screenshots/guardrails.png" alt="Settings — sandbox modes and guardrail rules" /></td>
  </tr>
</table>

> A full picture-by-picture tour is in the **[walkthrough guide](docs/WALKTHROUGH.md)**.

## Features

- **Unified chat / cowork / code** — one thread, no mode switching.
- **Local models, first-class** — auto-discover Ollama / LM Studio / vLLM; pull,
  load, and unload Ollama models; manage servers and watch token usage.
- **Cloud providers too** — Anthropic, OpenAI, OpenRouter, any OpenAI-compatible endpoint.
- **Context Inspector** — see exactly what enters the prompt (files, guidelines,
  memory, connectors) with live token counts; toggle and pin anything.
- **Guardrails** — risky commands (`rm -rf`, force push, `curl | sh`, …) prompt
  before running; configurable allow / ask / deny per rule.
- **Sandbox** — workspace-jail by default, optional Docker isolation, or ask-everything.
- **Multi-folder index** — add multiple roots; file + symbol index with fast search.
- **Memory** — global and per-project, stored as plain markdown.
- **Connectors** — Linear, Slack, Discord, Gmail, Google Drive.
- **Nekko the mascot** — peeks in from the edge, waves, and kneads cat biscuits.

## Architecture

npm-workspaces monorepo:

| Package | What |
| --- | --- |
| [`packages/shared`](packages/shared) | Types + IPC contracts (pure, no deps) |
| [`packages/core`](packages/core) | Engine: providers, agent loop, guardrails, context assembler, indexer, memory, connectors. Pure TS, unit-tested. |
| [`apps/desktop`](apps/desktop) | Electron app (main / preload / React renderer) |
| [`apps/website`](apps/website) | Static marketing site |

The core engine is Electron-free so it can be tested in isolation and reused.

## Develop

```bash
npm install
npm run build:core   # build shared + core
npm test             # vitest (guardrails, context, outline)
npm run dev          # launch the desktop app (electron-vite)
```

Build installers:

```bash
npm run dist         # electron-builder → apps/desktop/release
```

Releases are published to GitHub Releases by the [release workflow](.github/workflows/release.yml)
on `v*` tags. Download links on the [website](apps/website) point there.

## License

MIT © ermish
