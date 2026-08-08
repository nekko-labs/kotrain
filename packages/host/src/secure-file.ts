import { chmodSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function writeJsonAtomic(path: string, value: unknown): void {
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  const content = JSON.stringify(value, null, 2);
  writeFileSync(temp, content, { encoding: 'utf8', mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
  chmodSync(path, 0o600);
}
