/**
 * Infer which project (workspace) a new chat belongs to, from what we already
 * know: the folders/files attached to it and its first prompt. A project-less
 * chat that's clearly *about* a known project gets filed under it in the
 * sidebar instead of sitting under "General" forever.
 *
 * Pure + deterministic so it's unit-testable and runs anywhere (renderer or
 * host), in the spirit of `classifyAgent` / `matchSkills`.
 */

export interface ProjectHint {
  id: string;
  name: string;
  /** Absolute folder path, when known. */
  path?: string;
}

/** The final path segment, separator-agnostic. */
function basename(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]+/);
  return parts[parts.length - 1] ?? '';
}

/** Lowercase, forward-slashed, no trailing slash, for prefix comparison. */
function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/**
 * Names too generic to be a confident project signal on their own: a workspace
 * literally called "app" or "src" shouldn't claim every chat mentioning them.
 */
const STOPWORDS = new Set([
  'app', 'apps', 'api', 'web', 'src', 'code', 'test', 'tests', 'main', 'core',
  'dev', 'lib', 'ui', 'the', 'and', 'new', 'temp', 'tmp', 'work', 'project',
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether `token` appears as a standalone word in `text` (hyphen/underscore aware). */
function mentions(text: string, token: string): boolean {
  if (token.length < 3) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, 'i');
  return re.test(text);
}

/**
 * Pick the workspace a new chat most likely belongs to, or `null` when nothing
 * is a confident match (leave it in the General / no-project bucket).
 *
 * Signals:
 *  - an attached file/folder that lives inside a workspace's path (decisive)
 *  - the prompt naming the workspace, by its display name or folder basename
 *
 * A single clear signal files the chat. When the prompt names two *different*
 * projects (and no attachment settles it) we return `null` rather than guess,
 * so a chat is never filed under the wrong project.
 */
export function detectSessionWorkspace(opts: {
  text: string;
  workspaces: ProjectHint[];
  attachedPaths?: string[];
}): string | null {
  const text = (opts.text ?? '').toLowerCase();
  const attached = (opts.attachedPaths ?? []).map(normPath);

  type Hit = { id: string; path: boolean; name: number };
  const hits: Hit[] = [];

  for (const ws of opts.workspaces) {
    const wsPath = ws.path ? normPath(ws.path) : '';
    let path = false;
    if (wsPath) {
      path = attached.some((a) => a === wsPath || a.startsWith(wsPath + '/'));
    }
    let name = 0; // 0 = not named; otherwise the length of the strongest matched token
    const tokens = new Set<string>();
    if (ws.name) tokens.add(ws.name.toLowerCase());
    if (ws.path) tokens.add(basename(ws.path).toLowerCase());
    for (const tok of tokens) {
      if (STOPWORDS.has(tok)) continue;
      if (mentions(text, tok)) name = Math.max(name, tok.length);
    }
    if (path || name > 0) hits.push({ id: ws.id, path, name });
  }

  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0].id;

  // An attached folder is decisive. One path hit wins outright; several path
  // hits fall back to the longest name match, and a true tie stays ambiguous.
  const pathHits = hits.filter((h) => h.path);
  if (pathHits.length === 1) return pathHits[0].id;
  if (pathHits.length > 1) {
    pathHits.sort((a, b) => b.name - a.name);
    return pathHits[0].name !== pathHits[1].name ? pathHits[0].id : null;
  }

  // Matched by name only, and more than one project named → don't guess.
  return null;
}
