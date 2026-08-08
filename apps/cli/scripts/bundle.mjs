import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliDir = resolve(here, '..');
const dist = resolve(cliDir, 'dist');

mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [resolve(cliDir, 'src/index.ts')],
  outfile: resolve(dist, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: ['@lydell/node-pty'],
  logLevel: 'info',
});
