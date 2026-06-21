import React, { useState } from 'react';

/** Persisted relay pairing creds (set here, read by web-client.ts). */
const LS_RELAY = 'op_relay';

function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as { Capacitor?: unknown }).Capacitor;
}

function alreadyPaired(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.get('relay') && q.get('room') && q.get('key')) return true;
  try {
    const s = JSON.parse(localStorage.getItem(LS_RELAY) || 'null');
    return !!(s?.relay && s?.room && s?.key);
  } catch {
    return false;
  }
}

/** Parse a pairing link (`…/?relay=&room=&key=`) or raw query string. */
function parsePairing(input: string): { relay: string; room: string; key: string } | null {
  try {
    const q = input.includes('?') ? new URLSearchParams(input.slice(input.indexOf('?') + 1)) : new URLSearchParams(input);
    const relay = q.get('relay');
    const room = q.get('room');
    const key = q.get('key');
    if (relay && room && key) return { relay, room, key };
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * First-run pairing for the native mobile app: paste the pairing link shown in
 * the desktop app's Settings → Remote access (QR scanning is added in the
 * native build). On success we persist the creds and reload; web-client then
 * connects to your computer over the encrypted relay. Renders nothing unless
 * running inside the Capacitor shell and not yet paired.
 */
export function RelayPairing() {
  const [show] = useState(() => isNativeApp() && !alreadyPaired());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  if (!show) return null;

  const pair = () => {
    const creds = parsePairing(input.trim());
    if (!creds) {
      setError('That doesn’t look like a pairing link. Copy it from Settings → Remote access on your computer.');
      return;
    }
    localStorage.setItem(LS_RELAY, JSON.stringify(creds));
    location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6" style={{ background: 'var(--paper)' }}>
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl text-3xl" style={{ background: 'var(--accent-soft)' }}>🐾</div>
      <h1 className="text-xl font-semibold">Pair with your computer</h1>
      <p className="mt-2 max-w-sm text-center text-[13px] text-ink-faint">
        Open Paw on your desktop → <span className="font-medium text-ink-soft">Settings → Remote access → Enable</span>, then paste the pairing link here. Your phone drives the model on your computer over an end-to-end encrypted relay.
      </p>
      <textarea
        className="input mt-5 max-w-sm"
        rows={3}
        placeholder="Paste the pairing link (…/?relay=…&room=…&key=…)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {error && <p className="mt-2 max-w-sm text-center text-[12px]" style={{ color: '#e0574a' }}>{error}</p>}
      <button className="btn btn-primary mt-4 w-full max-w-sm" onClick={pair} disabled={!input.trim()}>Pair</button>
    </div>
  );
}
