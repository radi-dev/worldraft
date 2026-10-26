# Deployment

Three shapes, all from the same repository. Pick by who runs it and where.

| Shape | What runs | Who | Needs |
| --- | --- | --- | --- |
| **Local, one process** (default) | `worldraft` (FastAPI serving API + built UI) on 127.0.0.1 | end users via the release zip | uv |
| **Server, one origin** | the same process behind a reverse proxy with TLS | you, hosting it for others | uv, a reverse proxy |
| **Split** | static UI on a CDN/static host; backend on a separate service | you, at scale | Node to build, uv to run |

## Local, one process

Covered by [getting-started.md](getting-started.md). Configuration comes from
`.env` beside `backend/` (`WORLDRAFT_PORT`, …) or from environment variables.
The server only listens on `127.0.0.1`; it is not reachable from other
machines, by design.

## Server, one origin

Run the packaged app on the server and put a reverse proxy (Caddy, nginx,
Traefik) in front of it for TLS and a hostname:

```sh
unzip worldraft-<version>.zip && cd worldraft-<version>
WORLDRAFT_PORT=8000 NO_OPEN=1 sh start.sh          # or a systemd unit running the same command
# proxy https://studio.example.com -> http://127.0.0.1:8000
```

No CORS configuration is needed: the UI and the API share one origin. Add
authentication at the proxy; the application has none yet.

## Split: UI and API deployed separately

**UI** — build with the API's public URL baked in, then host `dist/` anywhere
static files can be served (GitHub Pages, Netlify, S3+CloudFront, nginx):

```sh
VITE_API_URL=https://api.example.com npm run build
# upload apps/studio/dist/
```

**API** — run the backend as a plain ASGI service and allow the UI's origin:

```sh
uv sync --project backend --locked --no-dev
WORLDRAFT_CORS_ORIGINS=https://studio.example.com \
  uv run --project backend --no-sync uvicorn studio.main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` is what makes the API reachable by your platform's load
balancer; only do this behind TLS and, once it exists, authentication. CORS
stays disabled unless `WORLDRAFT_CORS_ORIGINS` is set, so a default build
cannot accidentally accept browser calls from other sites.

Containers: the two commands above are the `CMD`s of two images — a Node image
running `npm ci && VITE_API_URL=… npm run build` whose `dist/` is copied into a
static server image, and a `ghcr.io/astral-sh/uv` based image running
`uv sync --locked --no-dev` then the uvicorn line. Dockerfiles are not checked
in yet; add them under `deploy/` when a target platform is chosen, and keep
the commands identical to the ones here so local and deployed behaviour match.

## What must stay true

- The frontend calls the API only through `apiUrl()` in `apps/studio/src/api.ts`.
- The backend never assumes it serves the UI: static hosting is added only by
  `studio.serve` (user mode), never in `studio.main`.
- New settings go into `studio/settings.py` with a safe default and a line in
  `.env.example`.
