import { buildRelay } from './server.js';

export { buildRelay, controlFrame, DEFAULT_LIMITS } from './server.js';

const PORT = Number(process.env.KOTRAIN_RELAY_PORT ?? process.env.OPENPAW_RELAY_PORT ?? 4400);
const HOST = process.env.KOTRAIN_RELAY_HOST ?? process.env.OPENPAW_RELAY_HOST ?? '0.0.0.0';

async function main() {
  const authzUrl = process.env.KOTRAIN_RELAY_AUTHZ_URL || undefined;
  const { app } = buildRelay({ authzUrl });
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n🐾 Kotrain relay listening on ws://${HOST}:${PORT}/relay`);
  console.log(`   access: ${authzUrl ? `gated (agents authorized via ${authzUrl})` : 'open (set KOTRAIN_RELAY_AUTHZ_URL to gate agent enrollment)'}`);
  console.log(`   push: ${process.env.APNS_KEY_P8 || process.env.FCM_SERVICE_ACCOUNT ? 'configured (APNs/FCM)' : 'disabled (set APNS_* and/or FCM_SERVICE_ACCOUNT)'}\n`);
}

// Run only when executed as the entrypoint (tests import buildRelay instead).
const { pathToFileURL } = await import('node:url');
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
