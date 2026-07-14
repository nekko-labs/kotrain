import React, { useEffect, useState } from 'react';
import type { ConnectorConfig, ConnectorKind, ConnectorResource } from '@open-paw/shared';
import { CONNECTOR_CATALOG } from '@open-paw/shared';
import { ConnectorIcon } from '../connectorIcons.js';

/** Where to get each connector's token, with a link to open. */
const HELP: Record<ConnectorKind, { hint: string; url: string }> = {
  github: { hint: 'Personal access token (fine-grained or classic) with repo read access, GitHub → Settings → Developer settings → Personal access tokens.', url: 'https://github.com/settings/tokens' },
  linear: { hint: 'Personal API key, Linear → Settings → Security & access → New API key.', url: 'https://linear.app/settings/api' },
  slack: { hint: 'Bot/User OAuth token (xoxb-/xoxp-) with channels:read + search:read scopes.', url: 'https://api.slack.com/apps' },
  discord: { hint: 'Bot token, Discord Developer Portal → your app → Bot → Reset Token.', url: 'https://discord.com/developers/applications' },
  gmail: { hint: 'OAuth access token with the gmail.readonly scope (one-click OAuth coming; for now grab a token from the OAuth Playground).', url: 'https://developers.google.com/oauthplayground' },
  gdrive: { hint: 'OAuth access token with the drive.readonly scope (one-click OAuth coming; for now grab a token from the OAuth Playground).', url: 'https://developers.google.com/oauthplayground' },
};

export function ConnectorsView() {
  const [configs, setConfigs] = useState<ConnectorConfig[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, ConnectorResource[] | string>>({});
  const [busy, setBusy] = useState<ConnectorKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => setConfigs(await window.nekko.listConnectors());
  useEffect(() => { load(); }, []);

  const isConnected = (k: ConnectorKind) => configs.find((c) => c.kind === k)?.connected;

  // Connect, then validate the token with a real fetch, only stay connected if
  // it actually works, so a bad token surfaces immediately instead of silently.
  const connect = async (k: ConnectorKind) => {
    if (!tokens[k] || busy) return;
    setBusy(k);
    setErrors((e) => ({ ...e, [k]: '' }));
    try {
      await window.nekko.connectConnector(k, tokens[k].trim());
      const res = await window.nekko.fetchConnector(k);
      setConfigs(await window.nekko.listConnectors());
      setTokens((t) => ({ ...t, [k]: '' }));
      setPreview((p) => ({ ...p, [k]: res }));
    } catch (e) {
      await window.nekko.disconnectConnector(k);
      setConfigs(await window.nekko.listConnectors());
      setErrors((er) => ({ ...er, [k]: (e as Error).message || 'Could not connect, check the token.' }));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (k: ConnectorKind) => {
    setConfigs(await window.nekko.disconnectConnector(k));
    setPreview((p) => ({ ...p, [k]: undefined as unknown as ConnectorResource[] }));
  };

  const fetchData = async (k: ConnectorKind) => {
    try {
      const res = await window.nekko.fetchConnector(k);
      setPreview((p) => ({ ...p, [k]: res }));
    } catch (e) {
      setPreview((p) => ({ ...p, [k]: (e as Error).message }));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <h1 className="text-2xl font-semibold">Connectors</h1>
        <p className="mt-1 text-[13px] text-ink-faint">Pull issues, messages, and docs into context. Tokens are stored locally and validated on connect.</p>

        <div className="mt-6 space-y-4">
          {CONNECTOR_CATALOG.map((meta) => {
            const connected = isConnected(meta.kind);
            const data = preview[meta.kind];
            const help = HELP[meta.kind];
            return (
              <div key={meta.kind} className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--surface-2)' }}>
                      <ConnectorIcon kind={meta.kind} size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{meta.label}</h3>
                      <p className="text-[12px] text-ink-faint">{meta.description}</p>
                    </div>
                  </div>
                  {connected && <span className="chip !text-white" style={{ background: '#4ec98a' }}>connected</span>}
                </div>

                {connected ? (
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-outline py-1.5 text-[12px]" onClick={() => fetchData(meta.kind)}>Fetch sample</button>
                    <button className="btn btn-ghost py-1.5 text-[12px]" onClick={() => disconnect(meta.kind)}>Disconnect</button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <input
                        className="input py-1.5 text-[12px]"
                        type="password"
                        placeholder={meta.auth === 'oauth' ? 'OAuth access token' : 'API token'}
                        value={tokens[meta.kind] ?? ''}
                        onChange={(e) => setTokens((t) => ({ ...t, [meta.kind]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') connect(meta.kind); }}
                        disabled={busy === meta.kind}
                      />
                      <button className="btn btn-primary py-1.5 text-[12px]" disabled={busy === meta.kind || !tokens[meta.kind]?.trim()} onClick={() => connect(meta.kind)}>
                        {busy === meta.kind ? 'Connecting…' : 'Connect'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      {help.hint}{' '}
                      <button className="text-accent hover:underline" onClick={() => window.nekko.openPath(help.url)}>Get a token →</button>
                    </p>
                    {errors[meta.kind] && <p className="mt-1 text-[11px]" style={{ color: '#e0574a' }}>{errors[meta.kind]}</p>}
                  </div>
                )}

                {data && (
                  <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl p-2" style={{ background: 'var(--surface-2)' }}>
                    {typeof data === 'string' ? (
                      <p className="text-[12px]" style={{ color: '#e0574a' }}>{data}</p>
                    ) : data.length === 0 ? (
                      <p className="text-[12px] text-ink-faint">No results.</p>
                    ) : (
                      data.map((r) => (
                        <div key={r.id} className="text-[12px]">
                          <span className="font-medium">{r.title}</span>
                          {r.subtitle && <span className="text-ink-faint"> · {r.subtitle}</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
