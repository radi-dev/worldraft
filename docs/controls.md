# Controls and functions — Task 01

All paths below are relative to this repository. No action trace exists yet; that is Task 02.

| Visible item | Current behavior | Source to inspect |
| --- | --- | --- |
| Worldraft wordmark | Reloads the studio root | `apps/studio/src/App.tsx`: `App` |
| Backend status and FastAPI connection | Reflect real `/api/health` results | `src/health.ts`: `useHealth`, `fetchHealth`; `backend/src/studio/main.py`: `get_health` |
| Cube and grid | Static labelled development fixture | `src/viewport/createViewport.ts`: `createViewport`, `FIXTURE_COLOR` |
| Canvas resize | Updates renderer size/camera aspect | `src/viewport/createViewport.ts`: `resizeViewport` |
| Canvas unmount/hot reload | Disposes resources and removes old canvas | `src/viewport/createViewport.ts`: `disposeViewport`; `Viewport.tsx`: effect cleanup |
| Layers rows | Descriptive only; no selection handler | `App.tsx`: Layers markup |
| Properties | Explains that selection is unavailable | `App.tsx`: Properties markup |
| Generate / Walk / Style / Remove / Export | Disabled; associated explanation and tooltip | `App.tsx`: `FutureControl` |
| Prompt field | Disabled; submits nothing | `App.tsx`: textarea |
| `npm run dev` | Starts services and tries one browser open | `scripts/dev.mjs`: `main`, `startService`, `waitForReady`, `openBrowser` |
| Ctrl+C in launching terminal | Stops owned process groups | `scripts/dev.mjs`: `shutdown`, `signalGroup` |

Paths beginning with `src/` above are inside `apps/studio/`.

## Your first exercise

1. Run `npm run dev` and open browser Network tools.
2. Change `FIXTURE_COLOR` to `'#e3a375'`. Notice that Vite updates the scene without asking the backend to generate anything.
3. Change `APP_LABEL` to `'My Worldraft'`. Watch the backend reload, then inspect `/api/health` and the updated status bar.
4. Restore both values, then explain the two distinct paths: source → renderer versus server → HTTP → React state.

The visible future controls deliberately have no handler. Task 02 will add the action trace and explicitly labelled placeholder events.
