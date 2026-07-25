import type { ContextItem } from '@kotrain/shared';

/**
 * Label, bar color, and plain-language explanation for each context source.
 * The single source of truth shared by the composer's context gauge and the
 * Context Inspector, so the color vocabulary can never drift between the two.
 */
export const SOURCE_META: Record<ContextItem['source'], { label: string; color: string; explain: string }> = {
  system: {
    label: 'System prompt',
    color: '#8a8f98',
    explain: "Kotrain's base instructions to the model, its role, available tools, and safety rules. Always included.",
  },
  conversation: {
    label: 'Conversation',
    color: '#6d5efc',
    explain: 'The running back-and-forth of this chat. Grows every turn — the biggest driver of context as a chat gets long.',
  },
  guideline: {
    label: 'Guidelines',
    color: '#c08adb',
    explain: 'Your project guideline files (AGENTS.md / CLAUDE.md and similar) that tell the model how to work in this repo.',
  },
  memory: {
    label: 'Memory',
    color: '#e0a44a',
    explain: 'Facts Kotrain remembers across chats, your preferences and project notes, that match this conversation.',
  },
  'attached-file': {
    label: 'Files',
    color: '#5b9dd9',
    explain: 'Files you attached to this chat. Included in full on every turn.',
  },
  connector: {
    label: 'Connectors',
    color: '#4ec98a',
    explain: 'Content pulled from your connected tools and integrations that is relevant to this prompt.',
  },
  'index-snippet': {
    label: 'Code index',
    color: '#5bc8c0',
    explain: "Code snippets retrieved from your workspace index that match this turn's prompt.",
  },
  skill: {
    label: 'Skill',
    color: '#e0574a',
    explain: 'The skill armed in the composer. Its instructions are added to your message when you send.',
  },
};

export function sourceMeta(src: string): { label: string; color: string } {
  return SOURCE_META[src as ContextItem['source']] ?? { label: src, color: '#8a8f98' };
}
