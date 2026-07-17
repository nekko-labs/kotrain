import { describe, it, expect } from 'vitest';
import {
  DOJO_SNAPSHOT,
  DOJO_CATALOG_URL,
  dojoSkillMdUrl,
  dojoCategory,
  dojoToMarketSkill,
  splitSkillMd,
  skillToMarkdown,
  marketToSkillDef,
  marketWorkflow,
  layoutWorkflow,
  MARKET_SKILLS,
} from '@kotrain/shared';

describe('nekko dojo catalog snapshot', () => {
  it('bundled snapshot is well-formed and offline-marked', () => {
    expect(DOJO_SNAPSHOT.source).toBe('bundled');
    expect(DOJO_SNAPSHOT.skills.length).toBeGreaterThan(0);
    for (const s of DOJO_SNAPSHOT.skills) {
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
      expect(['nekko-official', 'community']).toContain(s.tier);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('snapshot ids do not collide with the built-in marketplace catalog', () => {
    const builtin = new Set(MARKET_SKILLS.map((s) => s.id));
    for (const s of DOJO_SNAPSHOT.skills) expect(builtin.has(`dojo-${s.id}`)).toBe(false);
  });

  it('urls point at the dojo repo raw content', () => {
    expect(DOJO_CATALOG_URL).toContain('nekko-labs/nekko-dojo-skills');
    expect(dojoSkillMdUrl('nyaa')).toBe(
      'https://raw.githubusercontent.com/nekko-labs/nekko-dojo-skills/main/plugins/nyaa/skills/nyaa/SKILL.md',
    );
  });
});

describe('dojoCategory', () => {
  it('maps dojo categories onto Kotrain skill categories', () => {
    expect(dojoCategory('research')).toBe('Research & planning');
    expect(dojoCategory('engineering')).toBe('Code quality');
    expect(dojoCategory('delivery')).toBe('Delivery');
    expect(dojoCategory('something-else')).toBe('Automation');
  });
});

describe('splitSkillMd', () => {
  it('strips YAML frontmatter', () => {
    const md = '---\nname: nyaa\ndescription: cats\n---\n\n# nyaa\n\nBody here.';
    const { frontmatter, body } = splitSkillMd(md);
    expect(frontmatter).toContain('name: nyaa');
    expect(body.startsWith('# nyaa')).toBe(true);
  });

  it('passes through content with no frontmatter', () => {
    expect(splitSkillMd('just text').body).toBe('just text');
  });
});

describe('dojoToMarketSkill', () => {
  const entry = DOJO_SNAPSHOT.skills[0];

  it('produces a valid marketplace skill with dojo provenance', () => {
    const m = dojoToMarketSkill(entry);
    expect(m.id).toBe(`dojo-${entry.id}`);
    expect(m.name).toBe(entry.slug);
    expect(m.source).toBe('dojo');
    expect(m.tier).toBe(entry.tier);
    expect(m.template.length).toBeGreaterThan(0);
    expect(m.instructions.length).toBeGreaterThan(0);
    // Runnable in-app + layoutable workflow, same as any marketplace skill.
    const def = marketToSkillDef(m);
    const layout = layoutWorkflow(marketWorkflow(m));
    expect(def.name).toBe(m.name);
    expect(layout.nodes.length).toBeGreaterThan(2);
  });

  it('carries a fetched SKILL.md verbatim into file-based installs', () => {
    const md = '---\nname: nyaa\ndescription: cats\n---\n\n# nyaa\n\nFull real instructions.';
    const m = dojoToMarketSkill(entry, md);
    expect(m.markdown).toBe(md);
    expect(m.instructions).toContain('Full real instructions.');
    // skillToMarkdown must write the verbatim file, not a generated summary.
    expect(skillToMarkdown(m)).toBe(`${md}\n`);
  });

  it('falls back to the catalog description when no SKILL.md is available', () => {
    const m = dojoToMarketSkill(entry);
    expect(m.markdown).toBeUndefined();
    expect(m.instructions).toBe(entry.description);
    // Generated SKILL.md path still works.
    expect(skillToMarkdown(m)).toContain(`name: ${entry.slug}`);
  });
});
