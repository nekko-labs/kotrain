# Open Paw relay

A dumb, end-to-end-encrypted pipe that pairs a remote client (your phone) with a
local agent (your desktop) by room code, so a phone can drive your local model
with no inbound ports. The relay never sees conversation content — only the
routing envelope and content-free control frames.

```bash
npm run build -w @open-paw/relay
npm run start -w @open-paw/relay      # ws://0.0.0.0:4400/relay
```

Env: `OPENPAW_RELAY_PORT` (4400), `OPENPAW_RELAY_HOST` (0.0.0.0).

## Remote push (optional)

When a desktop finishes a run, it sends a content-free `notify` control frame.
If the paired phone is **offline**, the relay sends it a push notification using
the token the phone registered (`register-push` frame). Configure APNs:

| Env var | What |
| --- | --- |
| `APNS_KEY_P8` | Contents of the APNs auth key `.p8` (PEM, with newlines) |
| `APNS_KEY_ID` | The key's 10-char Key ID |
| `APNS_TEAM_ID` | Apple Team ID |
| `APNS_BUNDLE_ID` | App bundle id (default `dev.nekkolabs.openpaw`) |
| `APNS_PRODUCTION` | `1` for the production APNs host (default: sandbox) |

**Android (FCM)**: set `FCM_SERVICE_ACCOUNT` to the full service-account JSON
(with `client_email`, `private_key`, `project_id`). The relay mints an OAuth
token (RS256 assertion) and sends via FCM HTTP v1.

Without these the relay runs normally and just logs that push is disabled.

The privacy model holds: the push body is generic ("Your task finished"); the
relay only learns *that* a run completed, never its contents.
