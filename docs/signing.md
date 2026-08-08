# Release signing

How Kotrain's macOS builds get signed and notarized, what is wired, and what
needs a human with an Apple account.

Everything here is **secret-gated**. With no signing secrets configured the
release still builds and publishes, just unsigned, so nothing below can block a
release. A *partially* configured set fails the job before building, because a
signed-but-unnotarized app is still blocked by Gatekeeper while looking like it
worked.

## Status at a glance

| Platform | Mechanism | Wired | Blocked on |
| --- | --- | --- | --- |
| macOS | Developer ID codesign + notarization | ✅ wired | the org secrets being set |
| Windows | Authenticode | ✅ secret-gated | the org secrets being set |
| Linux | none (AppImage/deb are unsigned) | n/a | n/a |

## macOS

Kotrain is packaged by electron-builder, which does the signing, hardened
runtime, and notarization itself. There is no hand-rolled `codesign` pipeline
here, and no `Developer ID Installer` certificate is needed, because the
artifacts are `.dmg`/`.zip` rather than a `.pkg`.

What is configured, in `apps/desktop/electron-builder.yml`:

- `hardenedRuntime: true` — required for notarization
- `entitlements` / `entitlementsInherit` → `build/entitlements.mac.plist`
- `notarize: false` by default, flipped on with `-c.mac.notarize=true` by the
  release workflow, so a local `npm run dist` does not need the Apple API key

`apps/desktop/scripts/after-pack.cjs` ad-hoc signs the app **only when no real
certificate is present**, so unsigned local builds still launch on Apple
Silicon. It steps aside when `CSC_LINK` is set.

### The entitlements, and why each one is there

The hardened runtime disables things Electron and Kotrain need. See the
comments in [`build/entitlements.mac.plist`](../apps/desktop/build/entitlements.mac.plist);
the short version:

| Entitlement | Needed for |
| --- | --- |
| `allow-jit`, `allow-unsigned-executable-memory` | V8 |
| `disable-library-validation` | the `@lydell/node-pty` prebuilt `.node`, dlopen'd from outside the asar |
| `allow-dyld-environment-variables` | spawning shells, agents, and MCP servers |
| `files.user-selected.read-write` | the user's project folders |
| `network.client` / `network.server` | model providers and the local phone-relay server |
| `device.camera` | the QR pairing scanner |

`NSCameraUsageDescription` is set via `mac.extendInfo`. Without it macOS kills
the process instead of prompting when the QR scanner opens.

## Secrets

These are **`nekko-labs` organization secrets**, shared with `hypergate` and
`lightwrite`, so the certificate is uploaded and rotated in exactly one place.

| Secret | What it is |
| --- | --- |
| `MACOS_SIGNING_CERTS_P12` | base64 of the Developer ID `.p12` (→ `CSC_LINK`) |
| `MACOS_CERT_PASSWORD` | password for that `.p12` (→ `CSC_KEY_PASSWORD`) |
| `APPLE_API_KEY_P8` | App Store Connect API key contents |
| `APPLE_API_KEY_ID` | ASC key id |
| `APPLE_API_ISSUER` | ASC issuer id (a UUID) |
| `WINDOWS_SIGNING_CERTS_P12` | base64 of the Authenticode `.p12` certificate |
| `WINDOWS_CERT_PASSWORD` | password for that `.p12` |

Certificate: `Developer ID Application: Nekko Labs LLC (3HM5598S99)`.

### Uploading them

Run on a Mac that has the Developer ID certificate **and its private key** in
the login keychain (`security find-identity -v -p codesigning` to confirm).
Requires org-admin on `nekko-labs`.

```bash
security export -k login.keychain-db -t identities -f pkcs12 \
  -o /tmp/nekko-signing.p12
```

That prompts for an export password and for keychain access. Then:

```bash
gh secret set MACOS_SIGNING_CERTS_P12 --org nekko-labs --visibility all < <(base64 -i /tmp/nekko-signing.p12)
gh secret set MACOS_CERT_PASSWORD --org nekko-labs --visibility all
gh secret set APPLE_API_KEY_P8 --org nekko-labs --visibility all < AuthKey_XXXXXXXX.p8
gh secret set APPLE_API_KEY_ID --org nekko-labs --visibility all
gh secret set APPLE_API_ISSUER --org nekko-labs --visibility all
```

Then delete the export: `rm -P /tmp/nekko-signing.p12`.

## Windows

The release workflow passes `WINDOWS_SIGNING_CERTS_P12` and
`WINDOWS_CERT_PASSWORD` to electron-builder as `CSC_LINK` and
`CSC_KEY_PASSWORD`. With both secrets present, the NSIS installer is
Authenticode-signed. If no certificate is configured, the workflow deliberately
builds an unsigned installer so releases remain available; SmartScreen will
show an unknown-publisher warning. A certificate without its password is a
configuration error and fails the Windows job before packaging.

The certificate should contain the private key and be exported as a base64
PKCS#12 file:

```bash
base64 -w0 /path/to/windows-signing.p12 | \
  gh secret set WINDOWS_SIGNING_CERTS_P12 --org nekko-labs --visibility all
gh secret set WINDOWS_CERT_PASSWORD --org nekko-labs --visibility all
```

Certificates expire (Developer ID is 5 years). When it rolls, re-export and
re-run the two `MACOS_*` commands; nothing in this repo changes.

## Verifying a release

## Installer and updater targets

The release workflow intentionally publishes only targets with a clear
installation story:

| Platform | Artifact | `electron-updater` support |
| --- | --- | --- |
| Windows | NSIS `.exe` | ✅ automatic updates |
| macOS | `.dmg` plus required `.zip` metadata artifact | ✅ automatic updates |
| Linux | AppImage | ✅ automatic updates |
| Linux | `.deb` | ✅ supported by current electron-builder updater docs |

The Windows MSI and ZIP targets are not built: MSI is not an updater target and
the ZIP would duplicate the NSIS installation path without adding an updater
benefit. The current electron-builder documentation lists macOS DMG, Windows
NSIS, and Linux AppImage/DEB as auto-updatable targets. Unsigned builds can
still be installed, but signing warnings are independent of updater support.

The release workflow already runs these on every signed macOS build and fails
if any of them do. To check a downloaded `.dmg` by hand:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Kotrain.app
spctl --assess --type execute --verbose=4 /Applications/Kotrain.app
xcrun stapler validate /Applications/Kotrain.app
```

`spctl` should say `accepted` with `source=Notarized Developer ID`.

## Building signed locally

Only needed when debugging the signing config itself.

```bash
CSC_NAME="Nekko Labs LLC (3HM5598S99)" npm run dist -w @kotrain/desktop
```

`CSC_NAME` takes the certificate's **common name without the type prefix**.
Passing the full `Developer ID Application: ...` string fails with *"Please
remove prefix ... appropriate certificate will be chosen automatically"*.

That signs with the local keychain identity but does **not** notarize, so
`stapler validate` will fail on the result. That is expected; Gatekeeper on the
build machine still accepts it because the machine trusts the developer.
