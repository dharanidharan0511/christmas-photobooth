# ai/studio Enterprise

A **focused TP-Web** — the same third-party client against the AI Studio edge
engine, rebuilt here so we can change UI and handlers without touching
`newaistudio/TP-Web`.

Reference implementation:

```
../newaistudio/TP-Web
```

## Hard rule: engine only, never the gateway

Every HTTP call goes through `src/lib/engineClient.ts`. Base URL is
`import.meta.env.VITE_ENGINE_URL`. No page or component may call `fetch`
directly. Studio gateway paths are out of scope.

```
VITE_ENGINE_URL=http://localhost:9000
```

API map (copied from TP-Web):

- [`docs/engine-edge-apis.md`](docs/engine-edge-apis.md)
- [`docs/code-repo-chat.md`](docs/code-repo-chat.md)

## Screens (ported from TP-Web)

| Route | Purpose |
|---|---|
| `/` | Login (SSO, password, admin-key fallback) |
| `/dashboard` | Admin stats |
| `/users`, `/users/:id` | User management |
| `/roles` | Roles |
| `/audit` | Audit log |
| `/run` | Run a published mind |
| `/credits` | Spend / caps |
| `/code-repos`, `/code-repos/:repoId` | Repos, file viewer, CodeFlo chat |

Admin pages are admin-only. A regular signed-in user gets Run, Credits, and
Code Repos.

## Run

```bash
cp .env.example .env   # then edit VITE_ENGINE_URL if the engine is not on :9000
npm install
npm run dev            # http://localhost:5353
```

```bash
npm run build
npm run preview
```

This app uses **http://localhost:5353**, same origin as TP-Web. The engine
CORS allow-list must include that origin.

## Next

UI, layout, and handlers in this repo are the working copy. Change them
here; treat `newaistudio/TP-Web` as the behaviour reference.
