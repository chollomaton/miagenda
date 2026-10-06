# Cloud readiness — runtime injection

Single entry point: `src/cloud/CloudRuntime.ts`. No credentials are loaded from source,
VITE variables, localStorage or IndexedDB. The existing UI stays local-first when Cloud
is absent. This entry point prepares a separate cloud session for the initial probe;
it does not migrate local-workspace data or add a Cloud login UI.

Inject exactly this configuration object from the host at runtime:

| Key | Required value |
| --- | --- |
| `containerIdentifier` | Real `iCloud.…` container identifier |
| `environment` | `development` initially; `production` later through this same key |
| `apiToken` | Browser CloudKit Web Services API token authorized for the origin |
| `authCallback` | Absolute callback URL registered for Apple's web sign-in |
| `allowedOrigin` | Exact origin (scheme + host + optional port), without path/trailing slash |

Pass `window.location.origin` as the second constructor argument. Missing, malformed
or mismatched configuration yields `unavailable` without network requests. Valid
configuration without a session yields `signedOut`.

`ckWebAuthToken` is a separate, fresh session credential obtained through Apple's
sign-in flow at the registered callback and passed to `connect`. It is not a static
configuration variable. Callback registration and token acquisition remain host/Apple
integration inputs; this module does not implement a redirect/login UI. Keep the token
in memory only and remove it from the callback URL before rendering or logging.
The browser API token is visible in browser requests; never use a server-to-server
private key here. Do not commit real credentials. `.env*` files are ignored, but this
entry point deliberately does not read them.

## First real probe after Apple access is available

```ts
import {CloudRuntime} from './src/cloud/CloudRuntime';

// runtimeConfig and ckWebAuthToken are injected by the authenticated host.
const cloud = new CloudRuntime(runtimeConfig, window.location.origin);
const connection = await cloud.connect(ckWebAuthToken);
if (!connection) throw new Error('CLOUD_UNAVAILABLE');
const {session, repository} = connection;
const task = await session.store!.create('Task', {title: 'Synthetic Cloud probe'});
await session.sync!.sync();
if (session.store!.outbox.length) throw new Error('CLOUD_PUSH_PENDING');
const fetched = await repository.fetch(task.id);
if (JSON.stringify(fetched) !== JSON.stringify(task)) throw new Error('CLOUD_FETCH_MISMATCH');
await cloud.disconnect();
```

The connector verifies `users/current`, ensures private zone `MiAgendaWeb`, then
attaches `AgendaSession` and its existing `SyncEngine`. Writes go through IndexedDB,
outbox and existing conflict merge. Persistence is scoped to
`containerIdentifier:environment:userRecordName`. A logout invalidates the transport
and session; a subsequent login requires a fresh connection. Late responses cannot
attach a logged-out session. Local-workspace is independent and is never uploaded.

`connectCloudKitDevelopment` remains a Development-only compatibility wrapper.
Both environments use `connectCloudKit` and the same transport; changing environment
requires a new runtime/session and uses separate persistence. No Production network
request was made during readiness checks.

Apple setup must authorize the real Development schema for `MA_*` records encoded
in `CloudGateway.ts`, origin/callback, and development iCloud user. Real integration
remains unverified until Apple enables access. No deploy or Console action performed.

Transport errors expose only fixed codes, never upstream messages or request URLs.
Malformed fetched payloads become `invalidRecord`. Physical server deletion still
fails closed; app deletion remains a lifecycle tombstone. Lost write responses use
existing conflict fetch/merge, not a claimed CloudKit idempotency key.
