import React from 'react';
import { MiniNekko } from '../Mascot.js';
import { fmtTok } from './transcript.js';

/**
 * The console's reply footer: while a reply streams it shows elapsed time,
 * throughput and tokens generated; when idle it keeps a muted summary of the
 * last reply so the numbers stay visible at the end of the chat.
 */
export function ReplyFooter({
  streaming, waiting, elapsed, tps, out, last,
}: {
  streaming: boolean; waiting: boolean; elapsed: number; tps: number; out: number;
  last: { out: number; tps: number; secs: number } | null;
}) {
  if (streaming) {
    return (
      <div className="fade-in flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 text-[11.5px] text-ink-faint">
        <span className="flex items-center gap-2 text-ink-soft"><MiniNekko size={16} /> {waiting ? 'Nekko is working' : 'Streaming'}<span className="dots" /></span>
        {elapsed > 0 && <span>· {elapsed}s</span>}
        {tps > 0 && <span>· {tps} tok/s</span>}
        {out > 0 && <span>· {fmtTok(out)} tokens</span>}
      </div>
    );
  }
  if (last && last.out > 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-ink-faint/80">
        <span>Last reply</span>
        <span>· {fmtTok(last.out)} tokens</span>
        {last.tps > 0 && <span>· {last.tps} tok/s</span>}
        {last.secs > 0 && <span>· {last.secs}s</span>}
      </div>
    );
  }
  return null;
}
