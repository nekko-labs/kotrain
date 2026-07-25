import React, { useEffect, useState } from 'react';
import type { GpuStats } from '@kotrain/shared';

/**
 * Poll GPU/VRAM stats from the host. Returns null until the first successful
 * reading, and stays null on machines with no NVIDIA GPU (the host caches the
 * probe, so polling is cheap). Shared by the Chat metrics bar and Command Center.
 */
export function useGpuStats(pollMs = 4000): GpuStats | null {
  const [stats, setStats] = useState<GpuStats | null>(null);
  useEffect(() => {
    let live = true;
    const tick = () => {
      window.nekko.getGpuStats?.().then((s) => { if (live) setStats(s); }).catch(() => {});
    };
    tick();
    const t = setInterval(tick, pollMs);
    return () => { live = false; clearInterval(t); };
  }, [pollMs]);
  return stats;
}

const GB = (mb: number) => (mb / 1024).toFixed(mb / 1024 >= 10 ? 0 : 1);
const usedColor = (pct: number) => (pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)');

/**
 * Compact VRAM readout for the metrics bar: "VRAM 6.2 / 24 GB" with a mini bar
 * and a hover breakdown per GPU (used / free / utilization).
 */
export function VramInline({ stats }: { stats: GpuStats }) {
  const pct = stats.totalMB ? (stats.usedMB / stats.totalMB) * 100 : 0;
  return (
    <div className="group/vram relative flex cursor-default items-center gap-1.5">
      <span className="font-medium text-ink-soft">VRAM</span>
      <span>{GB(stats.usedMB)} / {GB(stats.totalMB)} GB</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: usedColor(pct) }} />
      </span>
      <div
        className="pointer-events-none absolute bottom-6 right-0 z-40 hidden w-64 rounded-xl border border-line p-3 text-[11px] shadow-lg group-hover/vram:block"
        style={{ background: 'var(--surface)' }}
      >
        <div className="mb-1.5 flex items-center justify-between font-semibold text-ink">
          <span>GPU memory</span>
          <span className="font-normal text-ink-faint">nvidia-smi</span>
        </div>
        {stats.devices.map((d, i) => {
          const dp = d.memoryTotalMB ? (d.memoryUsedMB / d.memoryTotalMB) * 100 : 0;
          return (
            <div key={i} className="mb-1.5 last:mb-0">
              <div className="flex justify-between">
                <span className="min-w-0 truncate text-ink-soft" title={d.name}>{d.name}</span>
                {d.utilizationPct != null && <span className="shrink-0 text-ink-faint">{d.utilizationPct}% util</span>}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span className="block h-full rounded-full" style={{ width: `${dp}%`, background: usedColor(dp) }} />
              </div>
              <div className="mt-0.5 flex justify-between text-ink-faint">
                <span>{GB(d.memoryUsedMB)} GB used</span>
                <span>{GB(d.memoryFreeMB)} GB free</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact VRAM dock for the Context panel's pinned footer: an aggregate
 * used/total bar plus a small per-GPU readout. Sized to sit in the narrow
 * (w-80) inspector column without scrolling.
 */
export function VramDock({ stats }: { stats: GpuStats }) {
  const pct = stats.totalMB ? (stats.usedMB / stats.totalMB) * 100 : 0;
  return (
    <div className="shrink-0 border-t border-line p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          GPU · VRAM
          <span className="chip text-[9px]">{stats.devices.length} GPU{stats.devices.length === 1 ? '' : 's'}</span>
        </span>
        <span className="text-[11px] tabular-nums text-ink-faint">{GB(stats.usedMB)} / {GB(stats.totalMB)} GB</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: usedColor(pct) }} />
      </div>
      <div className="mt-2.5 max-h-40 space-y-2 overflow-y-auto">
        {stats.devices.map((d, i) => {
          const dp = d.memoryTotalMB ? (d.memoryUsedMB / d.memoryTotalMB) * 100 : 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-[10.5px] text-ink-faint">
                <span className="min-w-0 truncate" title={d.name}>{d.name}</span>
                {d.utilizationPct != null && <span className="shrink-0 tabular-nums">{d.utilizationPct}% util</span>}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span className="block h-full rounded-full" style={{ width: `${dp}%`, background: usedColor(dp) }} />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-ink-faint">
                <span>{GB(d.memoryUsedMB)} GB used</span>
                <span>{GB(d.memoryFreeMB)} GB free</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-right text-[10px] text-ink-faint">via nvidia-smi</p>
    </div>
  );
}
