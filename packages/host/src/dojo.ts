import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { DojoCatalog, DojoCatalogSkill } from '@open-paw/shared';
import { DOJO_CATALOG_URL, DOJO_SNAPSHOT, dojoSkillMdUrl } from '@open-paw/shared';
import { dataDir } from './store.js';

/**
 * Nekko Dojo Skills hub (github.com/nekko-labs/nekko-dojo-skills), an optional
 * integration. Offline-first: the shelf renders from the bundled snapshot
 * (or the last cached live fetch) with zero network; a live fetch happens only
 * when the user explicitly refreshes, and a skill's SKILL.md is fetched at
 * install time so the real instructions get installed. Lives host-side so it
 * works in every edition (browser CSP / Docker can't fetch cross-origin).
 */

const FETCH_TIMEOUT_MS = 6000;

function cacheFile(): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'dojo.json');
}

function readCache(): DojoCatalog | null {
  try {
    const c = JSON.parse(readFileSync(cacheFile(), 'utf8')) as DojoCatalog;
    if (!Array.isArray(c.skills)) return null;
    return { ...c, source: 'cached' };
  } catch {
    return null;
  }
}

function validSkill(s: unknown): s is DojoCatalogSkill {
  const o = s as DojoCatalogSkill;
  return (
    !!o &&
    typeof o.id === 'string' &&
    typeof o.slug === 'string' &&
    /^[a-z0-9-]+$/.test(o.slug) &&
    typeof o.description === 'string' &&
    (o.tier === 'nekko-official' || o.tier === 'community')
  );
}

/**
 * The Dojo catalog. Without `refresh` this never touches the network:
 * last cached live fetch if present, else the bundled snapshot. With
 * `refresh` it fetches catalog.json from the Dojo repo (falling back to
 * cache/snapshot on failure).
 */
export async function getDojoCatalog(refresh = false): Promise<DojoCatalog> {
  if (!refresh) return readCache() ?? DOJO_SNAPSHOT;
  try {
    const res = await fetch(DOJO_CATALOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as { marketplace?: string; addCommand?: string; skills?: unknown[] };
    const skills = (raw.skills ?? []).filter(validSkill);
    if (skills.length === 0) throw new Error('Catalog had no valid skills.');
    const catalog: DojoCatalog = {
      marketplace: raw.marketplace ?? 'nekko-dojo-skills',
      addCommand: raw.addCommand,
      skills,
      source: 'live',
      fetchedAt: Date.now(),
    };
    writeFileSync(cacheFile(), JSON.stringify(catalog, null, 2), 'utf8');
    return catalog;
  } catch {
    return readCache() ?? DOJO_SNAPSHOT;
  }
}

/** Fetch a Dojo skill's verbatim SKILL.md (used at install time). */
export async function getDojoSkillMd(slug: string): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const res = await fetch(dojoSkillMdUrl(slug), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}
