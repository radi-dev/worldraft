# Worldraft

A local studio for AI-authored 3D worlds, built one task at a time.


## Start developing

Prerequisites: Node.js **22.12+**, npm, and [uv](https://docs.astral.sh/uv/getting-started/installation/). The backend uses Python **3.12** (uv can provision it when needed). Python 3.14 is outside this scaffold's supported range.

From the repository root, install the locked dependencies once:

```sh
npm ci
uv sync --project backend --locked
```

Then start both services with one command:

```sh
npm run dev
```

The launcher waits for FastAPI, Vite and the API proxy, then attempts to open **http://127.0.0.1:5173** once. Backend health is at **http://127.0.0.1:8000/api/health**. Press **Ctrl+C in the launching terminal** to stop both services and the backend reload worker. Hot reload does not open another tab.

With dependencies installed, the recurring development command uses `uv --no-sync --offline` and does not install anything or need internet access. No telemetry is configured; the launcher explicitly disables LangSmith tracing.

### Launch options

```sh
npm run dev -- --no-open
API_PORT=8010 UI_PORT=5180 npm run dev
DEV_STARTUP_TIMEOUT_MS=60000 npm run dev
npm run dev -- --help
```

Environment examples above use macOS/Linux shell syntax. `.env.example` documents the variables; the launcher **does not load `.env` files**. `NO_OPEN=1` also disables browser opening. `BROWSER` may name a single browser-launcher executable; it receives the URL as its first argument, without shell parsing.

Use `npm install` and `uv add --project backend ...` only when intentionally changing dependencies, and review the updated lockfiles. For an existing lockfile, prefer `npm ci` and `uv sync --locked`.

## What to inspect

1. Open the studio: see Layers, the cube/grid, Properties, the disabled prompt, and live backend status.
2. Change `FIXTURE_COLOR` in `apps/studio/src/viewport/createViewport.ts`; the cube updates through Vite.
3. Change `APP_LABEL` in `backend/src/studio/main.py`; Uvicorn reloads, and the status bar updates on its next health poll (within five seconds).
4. Open browser developer tools → Network → `/api/health` to follow the backend-to-UI path.

The cube is a development fixture, not an AI-generated asset. Layers are descriptive rows, not selectable entities. The camera is fixed; Task 03 introduces overview controls.

## Checks

```sh
npm run build
npm test
npm run test:integration
npm run test:backend
```

The integration tests launch their own services on free loopback ports and stop only their own subprocesses. They use a local browser-launcher fixture, so they do not open real tabs. The build currently reports a large Three.js bundle warning; performance work is scheduled for later tasks.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `uv is missing from PATH` | Install uv and restart your terminal. |
| Frontend dependencies missing | Run `npm ci` from this directory. |
| Backend environment/imports missing | Run `uv sync --project backend --locked`. |
| Port occupied | Stop the process you started, or choose free `API_PORT` and `UI_PORT` values. The launcher never kills a port's owner. |
| Browser failed to open | Paste the printed UI URL into your browser; the services continue running. |
| Backend offline | Inspect `[api]` output. The UI retries every five seconds. |
| Blank 3D viewport | Read the viewport error; use a browser with WebGL 2 and hardware acceleration. |
| Startup timed out | Inspect `[api]`/`[ui]` output before increasing the timeout. |

Automatic browser opening can be restricted in agent environments. Launching from your own terminal avoids that environment-specific restriction. Closing a terminal forcibly is not the same as sending Ctrl+C; use Ctrl+C for orderly cleanup.

## Roadmap and learning notes

- [Build guide](docs/BUILD_GUIDE.md): short task notes with offline context and test targets.
- [Architecture](docs/architecture.md): process boundaries and data flow.
- [Controls](docs/controls.md): visible controls and the functions behind them.
- [Task status](docs/tasks/STATUS.md) and [Task 01 handoff](docs/tasks/01.md).

The selected future Blender bridge is [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender), confirmed for this project. It is a community integration, not an official Blender Foundation product. Connection and version pinning begin in Task 11; no MCP server is installed or started in Task 01.

Licensed under the existing [MIT licence](LICENSE). Dependency and future model/asset licences remain separate.

## Offline work

Run `npm run test:offline` for deterministic tests. Start with [the offline pack](docs/offline/README.md) for saved references, fixtures, package caches and per-task context. Future live AI work still needs a suitable local model.
