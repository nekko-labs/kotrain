# Open Paw — Mobile (iOS & Android)

Native phone apps built with **Capacitor**. They run the same React UI as the
desktop/web editions and connect to the model on your computer over the
**end-to-end encrypted relay** — your phone never holds your model or keys; it
drives the agent running on your machine.

> This is the "drive your local model from your phone" edition. The UI is the
> shared renderer; only the transport (relay) and a pairing screen differ.

## How pairing works

1. On your **computer**: Open Paw → *Settings → Remote access → Enable*. It shows
   a room code, key, a pairing link, and a QR.
2. In the **phone app**: paste the pairing link on the first-run screen. The creds
   are stored locally and the app connects to your computer through the relay.
   (Camera QR scan is the next step — see *Next steps*.)

## Build & run

Prereqs: **iOS** needs macOS + Xcode + CocoaPods; **Android** needs Android Studio + SDK.

```bash
# 1. Build the shared web UI (from the repo root)
npm run build -w @open-paw/desktop

# 2. Install + sync the web assets into this Capacitor project
cd apps/mobile
npm install
npm run sync-web          # copies ../desktop/out/renderer → ./www

# 3. Add the native platforms (first time only)
npx cap add ios           # macOS only
npx cap add android

# 4. Open in the native IDE to run on a simulator/device
npx cap open ios          # Xcode
npx cap open android      # Android Studio
```

After changing the web UI, re-run `npm run sync-web && npx cap sync`.

`appId` is `dev.nekkolabs.openpaw`, matching the desktop bundle id.

## Next steps (tracked)

- **QR pairing** via `@capacitor/mlkit/barcode-scanning` (camera) instead of paste.
- **Push notifications** when a long agent run finishes.
- Native **secure storage** (`@capacitor/preferences` is installed) for the relay key.
- App Store / Play Store metadata + signing (needs the developer accounts).
