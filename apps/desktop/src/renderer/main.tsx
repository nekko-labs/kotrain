import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ensureNekkos } from './web-client.js';
import { CloudLogin, cloudAuthRequired } from './components/CloudLogin.js';
import './styles.css';

function registerServiceWorker() {
  // Web/PWA editions only (not Electron's file://).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

function startApp(root: ReturnType<typeof createRoot>) {
  // In Electron the preload bridge already defined window.nekkos; in the
  // web/Docker/Cloud editions this installs the HTTP/WS client (Cloud sends the
  // signed-in account's Bearer token). Either way the UI below is identical.
  ensureNekkos();
  registerServiceWorker();
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  // Only the hosted (Nekkos Cloud) edition gates on sign-in; everything else
  // mounts straight away.
  if (await cloudAuthRequired()) {
    root.render(<CloudLogin onAuthed={() => startApp(root)} />);
  } else {
    startApp(root);
  }
}

void boot();
