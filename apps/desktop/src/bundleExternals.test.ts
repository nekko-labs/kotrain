import { readdirSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

// Guards the launch crash that shipped in v0.4.0. The @kotrain/* workspace packages are
// ESM-only (their "exports" map offers just an "import" condition) while main and
// preload build to CJS, so if electron-vite leaves them external the packaged app
// dies immediately with ERR_PACKAGE_PATH_NOT_EXPORTED. They must be bundled in.
// electron-vite 5 externalizes every "dependencies" entry unless told otherwise,
// so this breaks again the moment a new workspace package is added to deps
// without also being excluded in electron.vite.config.ts.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const workspaceDeps = Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith('@kotrain/'));

describe('bundled main/preload externals', () => {
  it('has workspace packages to check', () => {
    expect(workspaceDeps.length).toBeGreaterThan(0);
  });

  for (const bundle of ['out/main/index.js', 'out/preload/index.js']) {
    it(`${bundle} does not require a workspace package at runtime`, () => {
      // CI builds every workspace (npm run build:web) before npm test.
      const src = readFileSync(join(root, bundle), 'utf8');
      const leaked = workspaceDeps.filter((dep) =>
        new RegExp(`require\\(\\s*["'\`]${dep}(/|["'\`])`).test(src),
      );
      expect(leaked).toEqual([]);
    });
  }

  for (const dep of workspaceDeps) {
    it(`${dep} is excluded from externalizeDeps in main and preload`, async () => {
      const config: any = (await import('../electron.vite.config.js')).default;
      expect(config.main.build.externalizeDeps.exclude).toContain(dep);
      expect(config.preload.build.externalizeDeps.exclude).toContain(dep);
    });
  }
});

// The other half of the launch fix: v0.4.0 shipped react 18 and react 19
// side by side in one renderer bundle (zustand is hoisted to the monorepo root
// and its `react` peer resolved to the root react 18), which left the hook
// dispatcher null and rendered a blank white window. React tags its internals
// with a version-specific key, so a second copy is easy to spot.
const REACT_INTERNALS_KEYS = [
  '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE', // react 19
  '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED', // react 18 and older
];

describe('bundled renderer React', () => {
  const assetsDir = join(root, 'out/renderer/assets');

  it('bundles exactly one copy of React', () => {
    const found = new Set<string>();
    for (const file of readdirSync(assetsDir).filter((f) => f.endsWith('.js'))) {
      const src = readFileSync(join(assetsDir, file), 'utf8');
      for (const key of REACT_INTERNALS_KEYS) if (src.includes(key)) found.add(key);
    }
    expect([...found]).toHaveLength(1);
  });

  it('bundles only the React version this app depends on', () => {
    // Resolve rather than hardcode a path: npm may hoist react to the repo root.
    const reactPkg = createRequire(join(root, 'package.json')).resolve('react/package.json');
    const expected = JSON.parse(readFileSync(reactPkg, 'utf8')).version;
    const versions = new Set<string>();
    for (const file of readdirSync(assetsDir).filter((f) => f.endsWith('.js'))) {
      const src = readFileSync(join(assetsDir, file), 'utf8');
      for (const m of src.matchAll(/"(\d+\.\d+\.\d+)"/g)) {
        if (/^(18|19|20)\./.test(m[1])) versions.add(m[1]);
      }
    }
    expect([...versions]).toEqual([expected]);
  });
});
