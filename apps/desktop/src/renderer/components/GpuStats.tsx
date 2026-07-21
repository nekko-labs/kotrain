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
const usedColor = (pct: number) => (pct > 90 ? '#e0574a' : pct > 70 ? '#e0a44a' : '#4ec98a');

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
 * Full VRAM panel for the Command Center: total / used / free with a bar per GPU.
 */
export function VramPanel({ stats }: { stats: GpuStats }) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">GPU &amp; VRAM</h2>
        <span className="chip">{stats.devices.length} GPU{stats.devices.length === 1 ? '' : 's'}</span>
        <span className="ml-auto text-[11px] text-ink-faint">via nvidia-smi</span>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-faint">Video memory in use across your GPUs. Local models load into VRAM.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {stats.devices.map((d, i) => {
          const pct = d.memoryTotalMB ? (d.memoryUsedMB / d.memoryTotalMB) * 100 : 0;
          return (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="min-w-0 truncate text-[13px] font-medium" title={d.name}>{d.name}</span>
                {d.utilizationPct != null && <span className="chip shrink-0">{d.utilizationPct}% util</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: usedColor(pct) }} />
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-ink-faint">
                <span><span className="text-ink">{GB(d.memoryUsedMB)}</span> used</span>
                <span><span className="text-ink">{GB(d.memoryFreeMB)}</span> free</span>
                <span><span className="text-ink">{GB(d.memoryTotalMB)}</span> GB total</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
