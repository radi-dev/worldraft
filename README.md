# Worldraft

A local studio for AI-authored 3D worlds, built one task at a time.

## Just want to run it?

Download the latest `worldraft-<version>.zip` from the **Releases** page, unzip it, install [uv](https://docs.astral.sh/uv/getting-started/installation/) once, then double-click `start.cmd` (Windows) or run `sh start.sh` (macOS/Linux). No Node.js, no Python setup, nothing to compile. Full instructions: [docs/getting-started.md](docs/getting-started.md).

The rest of this file is for developers.

## Start developing

Prerequisites, installed once by you (the scripts never install these):

- **Node.js 22 LTS** (22.12 or newer) — <https://nodejs.org/>. nvm users: the repo has an `.nvmrc`.
- **uv** — <https://docs.astral.sh/uv/getting-started/installation/>. uv provides Python **3.12** for the backend on its own; you do not need to install Python separately.

Then, from the repository root:

```sh
npm run dev          # or: sh dev.sh  /  dev.cmd  (same thing; dev.sh also activates nvm if needed)
```

The first launch verifies both tools, installs the locked frontend and backend dependencies (`npm ci`, `uv sync --locked`) and starts everything. Later launches detect that the lockfiles are unchanged and start in about two seconds without touching the network. No `venv` activation is ever needed.

The launcher waits for FastAPI, Vite and the API proxy, then attempts to open **http://127.0.0.1:5173** once. Backend health is at **http://127.0.0.1:8000/api/health**. Press **Ctrl+C in the launching terminal** to stop both services and the backend reload worker. Hot reload does not open another tab.

Useful on its own:

```sh
npm run setup            # verify tools and install/refresh dependencies, no launch
npm run setup:check      # report only; installs nothing
npm run setup -- --force # reinstall everything from the lockfiles
```

No telemetry is configured; the launcher explicitly disables LangSmith tracing. See [docs/setup.md](docs/setup.md) for how the setup works, how to add dependencies, and how to extend the checks.

### Launch options

```sh
npm run dev -- --no-open
API_PORT=8010 UI_PORT=5180 npm run dev
DEV_STARTUP_TIMEOUT_MS=60000 npm run dev
npm run dev -- --help
```

Environment examples above use macOS/Linux shell syntax. The launcher reads these from the environment **only** (it prints a note if it finds them in `.env`). **Application** settings are different: `WORLDRAFT_*` may live in a `.env` file in this folder, with environment variables taking precedence. `.env.example` lists both groups. `NO_OPEN=1` also disables browser opening. `BROWSER` may name a single browser-launcher executable; it receives the URL as its first argument, without shell parsing.

Use `npm install ... --workspace @worldraft/studio` and `uv add --project backend ...` only when intentionally changing dependencies, and commit the updated lockfiles; everyone else's next `npm run dev` picks the change up automatically.

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
npm run package        # build + stage + zip a user-mode release into release/
```

Pushing a tag `v<version>` makes GitHub Actions build the release zip and attach it to a GitHub Release; see [docs/setup.md](docs/setup.md#cutting-a-release).

The integration tests launch their own services on free loopback ports and stop only their own subprocesses. They use a local browser-launcher fixture, so they do not open real tabs. The build currently reports a large Three.js bundle warning; performance work is scheduled for later tasks.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `uv is missing from PATH` | Install uv (link printed in the message) and open a new terminal. |
| `Node.js 22.12+ is required` | Install the current Node.js 22 LTS and open a new terminal. |
| Dependencies fail to install | Check the network, then `npm run setup -- --force`. |
| Something looks half-installed | Delete `node_modules` and/or `backend/.venv`; the next `npm run dev` reinstalls. |
| Port occupied | If a previous `npm run dev` was cut off (closed tab, killed IDE terminal), the next launch stops its own leftover services automatically. Anything else on the port is never killed: stop it, or choose free `API_PORT` and `UI_PORT` values. |
| Browser failed to open | Paste the printed UI URL into your browser; the services continue running. |
| Backend offline | Inspect `[api]` output. The UI retries every five seconds. |
| Blank 3D viewport | Read the viewport error; use a browser with WebGL 2 and hardware acceleration. |
| Startup timed out | Inspect `[api]`/`[ui]` output before increasing the timeout. |

Automatic browser opening can be restricted in agent environments. Launching from your own terminal avoids that environment-specific restriction. Ctrl+C is the orderly way to stop; closing the terminal also stops the services now, and the next launch cleans up anything a hard kill left behind.

## Roadmap and learning notes

- [Environment setup](docs/setup.md): how the setup scripts work, shutdown/port handling, how to extend them.
- [Deployment](docs/deployment.md): local, single-origin server, or split UI/API.
- Build guide, architecture, controls and task notes are not yet written; they will live under `docs/`.

The selected future Blender bridge is [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender), confirmed for this project. It is a community integration, not an official Blender Foundation product. Connection and version pinning begin in Task 11; no MCP server is installed or started in Task 01.

Licensed under the existing [MIT licence](LICENSE). Dependency and future model/asset licences remain separate.

## Offline work

Run `npm run test:offline` for deterministic tests. `scripts/cache-offline-context.py` can download reference documentation into `docs/offline/` for offline reading; it is optional and never used by the app or tests. Future live AI work still needs a suitable local model.
