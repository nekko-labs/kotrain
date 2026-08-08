import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeJsonAtomic } from './secure-file.js';

describe('secure JSON persistence', () => {
  it('writes complete JSON with private permissions and no temp files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kotrain-secure-'));
    const path = join(dir, 'settings.json');
    writeJsonAtomic(path, { token: 'secret', nested: { ok: true } });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ token: 'secret', nested: { ok: true } });
    expect(readdirSync(dir)).toEqual(['settings.json']);
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
