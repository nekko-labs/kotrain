import React from 'react';
import type { ToolCall } from '@kotrain/shared';
import { ShieldIcon } from '../../icons.js';
import { Badge } from '../primitives/index.js';
import { STATUS } from '../../tokens.js';

export interface PendingApproval {
  call: ToolCall;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;

/** The guardrail prompt under the transcript: what the agent wants to run, and
 *  the two decisions. */
export function ApprovalBar({ approval, onDecide }: { approval: PendingApproval; onDecide: (ok: boolean) => void }) {
  const tone = SEVERITY_TONE[approval.severity];
  return (
    <div className="border-t border-line px-5 py-3" style={{ background: 'var(--surface-2)' }}>
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className="shrink-0" style={{ color: STATUS[tone] }}><ShieldIcon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">Approval required</span>
            <Badge tone={tone} variant="solid" className="text-[10px]">{approval.severity}</Badge>
            <span className="text-[12px] text-ink-faint">{approval.reason}</span>
          </div>
          <code className="mt-0.5 block truncate font-mono text-[12px] text-ink-soft">
            {String((approval.call.input as Record<string, unknown>).command ?? JSON.stringify(approval.call.input))}
          </code>
        </div>
        <button className="btn btn-outline" onClick={() => onDecide(false)}>Deny</button>
        <button className="btn btn-primary" onClick={() => onDecide(true)}>Approve</button>
      </div>
    </div>
  );
}
