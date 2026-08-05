import { execFile } from 'child_process';
import type { GpuStats } from '@kotrain/shared';

/**
 * GPU/VRAM stats for the Chat metrics bar and Command Center. Backed by
 * `nvidia-smi` (the one query that works identically on Windows and Linux); we
 * return null when it isn't present (no NVIDIA driver, or Apple Silicon's unified
 * memory, which has no discrete-VRAM equivalent to report). Results are cached
 * briefly so a polling UI doesn't spawn a process on every tick.
 */

let cache: { at: number; stats: GpuStats | null } | null = null;
const TTL_MS = 2500;
let inFlight: Promise<GpuStats | null> | null = null;

export async function getGpuStats(): Promise<GpuStats | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.stats;
  if (inFlight) return inFlight;
  inFlight = queryNvidiaSmi()
    .then((stats) => {
      cache = { at: Date.now(), stats };
      return stats;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Run a command, resolving its stdout or null on any failure/timeout. */
function run(cmd: string, args: string[], timeoutMs = 4000): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      resolve(err ? null : stdout);
    });
  });
}

async function queryNvidiaSmi(): Promise<GpuStats | null> {
  const stdout = await run('nvidia-smi', [
    '--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu',
    '--format=csv,noheader,nounits',
  ]);
  if (!stdout) return null;

  const devices = stdout
    .trim()
    .split('\n')
    .map((line) => line.split(',').map((s) => s.trim()))
    .filter((cols) => cols.length >= 4)
    .map((cols) => {
      const [name, total, used, free, util] = cols;
      return {
        name: name || 'GPU',
        memoryTotalMB: Number(total) || 0,
        memoryUsedMB: Number(used) || 0,
        memoryFreeMB: Number(free) || 0,
        utilizationPct: util !== undefined && util !== '' && util !== '[N/A]' ? Number(util) : undefined,
      };
    })
    .filter((d) => d.memoryTotalMB > 0);

  if (devices.length === 0) return null;
  return {
    source: 'nvidia-smi',
    devices,
    totalMB: devices.reduce((s, d) => s + d.memoryTotalMB, 0),
    usedMB: devices.reduce((s, d) => s + d.memoryUsedMB, 0),
    freeMB: devices.reduce((s, d) => s + d.memoryFreeMB, 0),
  };
}
