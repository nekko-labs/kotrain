import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { DesignBoard, DesignPage } from '@kotrain/shared';
import { dataDir } from './store.js';

/**
 * Design board persistence: a Figma-style board of an app's UI pages (a label +
 * a URL the page renders at) plus persistent notes pinned to each page. Stored
 * in one JSON file keyed by workspaceId. The page "snapshots" are live scaled
 * previews rendered in the UI, only the page list + notes are persisted here.
 */

type Store = Record<string, DesignPage[]>;

function file(): string {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'design.json');
}

function load(): Store {
  try {
    return JSON.parse(readFileSync(file(), 'utf8')) as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  writeFileSync(file(), JSON.stringify(store, null, 2), 'utf8');
}

function board(workspaceId: string, store: Store): DesignBoard {
  return { workspaceId, pages: store[workspaceId] ?? [] };
}

export function getDesignBoard(workspaceId: string): DesignBoard {
  return board(workspaceId, load());
}

export function addDesignPage(workspaceId: string, label: string, url: string): DesignBoard {
  const store = load();
  const now = Date.now();
  const page: DesignPage = { id: randomUUID(), label: label.trim() || url, url: url.trim(), notes: [], createdAt: now, updatedAt: now };
  store[workspaceId] = [...(store[workspaceId] ?? []), page];
  save(store);
  return board(workspaceId, store);
}

export function updateDesignPage(
  workspaceId: string,
  pageId: string,
  patch: Partial<Pick<DesignPage, 'label' | 'url'>>,
): DesignBoard {
  const store = load();
  store[workspaceId] = (store[workspaceId] ?? []).map((p) =>
    p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p,
  );
  save(store);
  return board(workspaceId, store);
}

export function removeDesignPage(workspaceId: string, pageId: string): DesignBoard {
  const store = load();
  store[workspaceId] = (store[workspaceId] ?? []).filter((p) => p.id !== pageId);
  save(store);
  return board(workspaceId, store);
}

export function addDesignNote(workspaceId: string, pageId: string, text: string): DesignBoard {
  const store = load();
  store[workspaceId] = (store[workspaceId] ?? []).map((p) =>
    p.id === pageId
      ? { ...p, notes: [...p.notes, { id: randomUUID(), text: text.trim(), createdAt: Date.now() }], updatedAt: Date.now() }
      : p,
  );
  save(store);
  return board(workspaceId, store);
}

export function resolveDesignNote(workspaceId: string, pageId: string, noteId: string): DesignBoard {
  const store = load();
  store[workspaceId] = (store[workspaceId] ?? []).map((p) =>
    p.id === pageId ? { ...p, notes: p.notes.filter((n) => n.id !== noteId), updatedAt: Date.now() } : p,
  );
  save(store);
  return board(workspaceId, store);
}
