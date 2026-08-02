import { existsSync, mkdirSync } from 'fs';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The host's data directory is injected by each runtime (Electron passes
 * `app.getPath('userData')/nekkos`; the web server passes its own dir) so the
 * service layer stays free of any runtime-specific dependency.
 *
 * A single process normally serves one data dir (`_dir`, set via `setDataDir`).
 * Nekkos Cloud runs many accounts in one process, so it wraps each authenticated
 * request in `withDataDir(accountDir, …)`; `dataDir()` then prefers the
 * request-scoped dir over the global default. Editions that never call
 * `withDataDir` (Electron, the self-hosted server, the CLI) are unaffected.
 */
let _dir = '';
const scope = new AsyncLocalStorage<string>();

export function setDataDir(dir: string): void {
  _dir = dir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function dataDir(): string {
  const scoped = scope.getStore();
  if (scoped) return scoped;
  if (!_dir) throw new Error('Host not initialized, call createHost({ dataDir }) first.');
  return _dir;
}

/**
 * Run `fn` with a request-scoped data dir. Used by Nekkos Cloud to isolate each
 * account's data within a single process; the scope propagates across awaits.
 */
export function withDataDir<T>(dir: string, fn: () => T): T {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return scope.run(dir, fn);
}
