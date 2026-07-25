import React, { useState } from 'react';
import { useGpuStats } from './GpuStats.js';

const GB = (mb: number) => (mb / 1024).toFixed(mb / 1024 >= 10 ? 0 : 1);
const usedColor = (pct: number) => (pct > 90 ? '#e0574a' : pct > 70 ? '#e0a44a' : '#4ec98a');

/**
 * A small always-on GPU monitor pinned to the bottom-right corner, visible on
 * every tab (local models live in VRAM, so this matters everywhere). Collapsed
 * it is a quiet pill: utilization + VRAM used/total with a micro-bar. Hover or
 * click expands a per-GPU breakdown. Renders nothing on machines without an
 * NVIDIA GPU. The mascot owns the bottom-left corner; this owns the right.
 */
export function GpuHud() {
  const stats = useGpuStats(5000);
  const [open, setOpen] = useState(false);
  if (!stats || stats.devices.length === 0) return null;

  const pct = stats.totalMB ? (stats.usedMB / stats.totalMB) * 100 : 0;
  const util = Math.max(0, ...stats.devices.map((d) => d.utilizationPct ?? 0));

  return (
    <div
      className="fixed bottom-20 right-4 z-30 md:bottom-4"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-line p-3 text-[11px]"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="mb-1.5 flex items-center justify-between font-semibold text-ink">
            <span>GPU monitor</span>
            <span className="font-normal text-ink-faint">via nvidia-smi</span>
          </div>
          {stats.devices.map((d, i) => {
            const dp = d.memoryTotalMB ? (d.memoryUsedMB / d.memoryTotalMB) * 100 : 0;
            return (
              <div key={i} className="mb-1.5 last:mb-0">
                <div className="flex justify-between">
                  <span className="min-w-0 truncate text-ink-soft" title={d.name}>{d.name}</span>
                  {d.utilizationPct != null && <span className="shrink-0 tabular-nums text-ink-faint">{d.utilizationPct}% util</span>}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <span className="block h-full rounded-full" style={{ width: `${dp}%`, background: usedColor(dp) }} />
                </div>
                <div className="mt-0.5 flex justify-between tabular-nums text-ink-faint">
                  <span>{GB(d.memoryUsedMB)} GB used</span>
                  <span>{GB(d.memoryFreeMB)} GB free</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button
        className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11px] tabular-nums text-ink-faint"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
        aria-label="GPU monitor"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-ink-soft">GPU</span>
        <span>{util}%</span>
        <span className="h-1.5 w-10 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: usedColor(pct) }} />
        </span>
        <span>{GB(stats.usedMB)}/{GB(stats.totalMB)} GB</span>
      </button>
    </div>
  );
}
