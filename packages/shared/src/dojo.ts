/**
 * Nekko Dojo Skills integration: an optional connection to the public
 * Agent Skills hub at github.com/nekko-labs/nekko-dojo-skills (browsable at
 * dojo.nekkolabs.com). The Dojo is a separate app; Open Paw only reads its
 * machine-readable catalog and installs skills the user explicitly picks.
 *
 * Offline-first: the marketplace shelf renders from the bundled snapshot
 * below with zero network. The catalog is only fetched from GitHub when the
 * user clicks "Refresh from Dojo" (and a skill's SKILL.md is fetched at
 * install time so the real, current instructions are installed).
 */

import type { MarketplaceSkill } from './skills-market.js';
import type { SkillCategory } from './skills.js';

/** Trust tiers from the Dojo repo. Official = built + reviewed by Nekko Labs. */
export type DojoTier = 'nekko-official' | 'community';

/** One entry of the Dojo repo's catalog.json. */
export interface DojoCatalogSkill {
  id: string;
  name: string;
  slug: string;
  tier: DojoTier;
  /** Dojo's free-form category (research, engineering, ...). */
  category: string;
  description: string;
  tags?: string[];
  author: string;
  version?: string;
  license?: string;
  installCommand?: string;
  sourceUrl?: string;
}

export interface DojoCatalog {
  marketplace: string;
  addCommand?: string;
  skills: DojoCatalogSkill[];
  /** Where this catalog came from. */
  source: 'live' | 'cached' | 'bundled';
  /** Epoch ms of the last successful live fetch (absent for bundled). */
  fetchedAt?: number;
}

export const DOJO_REPO = 'nekko-labs/nekko-dojo-skills';
export const DOJO_REPO_URL = `https://github.com/${DOJO_REPO}`;
export const DOJO_SITE_URL = 'https://dojo.nekkolabs.com/skills';
export const DOJO_CATALOG_URL = `https://raw.githubusercontent.com/${DOJO_REPO}/main/catalog.json`;

/** Raw URL of a Dojo skill's SKILL.md (agentskills.io plugin layout). */
export function dojoSkillMdUrl(slug: string): string {
  return `https://raw.githubusercontent.com/${DOJO_REPO}/main/plugins/${slug}/skills/${slug}/SKILL.md`;
}

/**
 * Bundled snapshot of the Dojo catalog so the shelf works fully offline.
 * Kept in sync with the repo's catalog.json when the integration is touched.
 */
export const DOJO_SNAPSHOT: DojoCatalog = {
  marketplace: 'nekko-dojo-skills',
  addCommand: '/plugin marketplace add nekko-labs/nekko-dojo-skills',
  source: 'bundled',
  skills: [
    {
      id: 'domain-finder',
      name: 'Domain Finder',
      slug: 'domain-finder',
      tier: 'nekko-official',
      category: 'research',
      description:
        'Brainstorm startup/project names, check domain availability across TLDs via RDAP, and vet brand/trademark conflicts.',
      tags: ['domains', 'naming', 'branding', 'rdap', 'startup', 'trademark'],
      author: 'Nekko Labs',
      version: '1.0.0',
      license: 'MIT',
      sourceUrl: `${DOJO_REPO_URL}/tree/main/plugins/domain-finder`,
    },
    {
      id: 'nyaa',
      name: 'nyaa',
      slug: 'nyaa',
      tier: 'nekko-official',
      category: 'engineering',
      description:
        'Convene a council of four reviewer cats (security, deps/supply-chain, correctness/concurrency, style) over a PR or working diff, pulling in external bot reviews too.',
      tags: ['code-review', 'pull-request', 'security', 'dependencies', 'supply-chain', 'concurrency', 'lint'],
      author: 'Nekko Labs',
      version: '1.0.0',
      license: 'MIT',
      sourceUrl: `${DOJO_REPO_URL}/tree/main/plugins/nyaa`,
    },
  ],
};

/** Map the Dojo's free-form category onto Open Paw's skill categories. */
export function dojoCategory(cat: string): SkillCategory {
  const c = cat.toLowerCase();
  if (/research|planning|naming|brainstorm/.test(c)) return 'Research & planning';
  if (/engineering|review|quality|security|test|lint/.test(c)) return 'Code quality';
  if (/delivery|release|ship|deploy|docs/.test(c)) return 'Delivery';
  return 'Automation';
}

/** Strip YAML frontmatter from a SKILL.md, returning { frontmatter, body }. */
export function splitSkillMd(md: string): { frontmatter: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!m) return { frontmatter: '', body: md.trim() };
  return { frontmatter: m[1], body: md.slice(m[0].length).trim() };
}

/**
 * A Dojo catalog entry as a marketplace skill. When the full SKILL.md is
 * available (fetched at install time) it rides along verbatim as `markdown`
 * so file-based installs get the real skill, not a summary.
 */
export function dojoToMarketSkill(d: DojoCatalogSkill, skillMd?: string): MarketplaceSkill {
  const body = skillMd ? splitSkillMd(skillMd).body : undefined;
  const id = `dojo-${d.id}`;
  return {
    id,
    // Installed skills are invoked as /<name>; use the slug (already kebab-case).
    name: d.slug,
    description: d.description,
    author: d.author,
    source: 'dojo',
    tier: d.tier,
    category: dojoCategory(d.category),
    url: d.sourceUrl ?? DOJO_REPO_URL,
    template: `Use the ${d.name} skill. ${d.description}\n\n`,
    instructions: body ?? d.description,
    markdown: skillMd,
  };
}
