# Task 01 architecture

## Process boundaries

```text
npm run dev
  scripts/dev.mjs (Node supervisor)
    ├─ uv run --no-sync --offline ... uvicorn studio.main:app --reload
    │    └─ FastAPI worker at 127.0.0.1:8000
    └─ Vite at 127.0.0.1:5173
         └─ browser: React + TypeScript + Three.js
```

The supervisor validates configuration and dependencies, probes both ports, starts services, and checks readiness before requesting one browser launch. It serves only on loopback. `API_PORT` and `UI_PORT` are passed to Vite so its `/api` proxy follows backend configuration.

The frontend and backend are separate processes. Neither imports the other's source. Vite proxies `/api/health`, so the browser needs no permissive CORS settings. There is no generation endpoint, job worker, database, authentication or MCP connection yet.

## Follow the UI data

`index.html` → `src/main.tsx` mounts React → `App.tsx` lays out the studio.

`useHealth()` → `fetchHealth()` → browser `/api/health` → Vite proxy → FastAPI `get_health()` → typed JSON → React health state → connection label and status bar.

The health hook aborts requests when unmounted, limits each request to four seconds, and polls every five seconds. It verifies the response shape before using it. Loading, connected and offline states are distinct; a failed request cannot show a false success.

`Viewport` mounts → `createViewport(container)` creates the renderer, scene, camera, cube, lights and grid → `resizeViewport()` measures the container, updates camera aspect and renders → React cleanup calls `disposeViewport()`.

The scene is static, so it does not need a continuous animation loop. A `ResizeObserver` renders when the container changes size. Cleanup disconnects the observer, disposes geometry/materials/renderer and removes the canvas. React StrictMode can mount, clean up and mount again without adding duplicate canvases.

## The placeholder graph

`studio.main` calls `build_placeholder_graph()` during import. The graph consists of typed state, `START → mark_ready → END`. Compilation proves the LangGraph dependency is usable before health becomes available. The graph is not run by the UI or the health endpoint; a focused test invokes it locally.

LangChain is installed, version-pinned and reported in health. There is no provider configuration, prompt generation or tool use. The graph's `ready` result means its deterministic node executed, not that an asset was generated.

## Future integration boundary

Use **[ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender)** for the planned Blender MCP bridge. The user confirmed this repository on 23 October 2026. Task 11 must inspect and pin a tested version, connect read-only first, and document its telemetry settings. Task 01 must not install Blender, launch MCP, enable external integrations or execute generated modelling code.

Later tasks introduce stable entity IDs, shared assets, commands, jobs and schemas. The current cube is deliberately not wrapped in those future abstractions.

## Shutdown and failure handling

The supervisor owns the process handles it creates. On POSIX, services run in separate process groups; SIGINT/SIGTERM triggers graceful termination of both groups, then forced termination after a grace period if needed. This includes Uvicorn's reload child. On Windows, the corresponding implementation uses `taskkill /T`; it has not been tested on Windows.

If either service fails after spawning, the supervisor aborts readiness checks and stops its sibling. Port conflicts fail before services start. Missing tools/dependencies produce a setup instruction. Browser-open failure is nonfatal. Readiness and browser launch have bounded timeouts.

Tests launch fresh processes and signal only their owned children; they do not find processes by port and kill them.

## Tested dependency baseline

| Component | Version |
| --- | --- |
| Node.js / npm | 22.22.3 / 10.9.8 |
| uv / Python | 0.11.31 / 3.12.11 |
| React / React DOM | 19.3.1 / 19.3.1 |
| TypeScript / Vite | 7.0.2 / 8.3.5 |
| Three.js | 0.186.1 |
| FastAPI / Uvicorn | 0.161.1 / 0.54.0 |
| LangChain / LangGraph | 1.4.7 / 1.2.16 |

Direct application dependencies use exact versions; `package-lock.json` and `backend/uv.lock` capture the full resolutions. macOS arm64 is the tested host. Linux, Windows, actual mobile devices and a native system-browser launch outside the agent environment remain unverified.

References: [Vite setup](https://vite.dev/guide/), [LangGraph graph API](https://docs.langchain.com/oss/python/langgraph/graph-api), [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
