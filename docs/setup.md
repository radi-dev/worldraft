# Environment setup: how it works and how to extend it

This document is for contributors. End-user instructions live in the README.

## Two modes, two sets of prerequisites

| Mode | Who | Gets the code how | Needs installed | Entry point |
| --- | --- | --- | --- | --- |
| **Developer** | people changing the code | `git clone` | Node.js 22 LTS, uv | `npm run dev` (or `dev.sh` / `dev.cmd`) |
| **User** | people running the tool | Release zip from GitHub | uv only | `start.sh` / `start.cmd` |

Developer mode runs Vite (hot reload) and uvicorn (`--reload`) side by side,
with Vite proxying `/api` to the backend. User mode runs one process: the
FastAPI backend with the *prebuilt* frontend mounted as static files
(`backend/src/studio/serve.py`), so Node.js is never needed on the user's
machine.

## From one repository to both modes

```
 git clone ──► npm run dev ──────────────────────────────► developer (Vite + uvicorn --reload)
                    │
                    ▼ (on a tag v1.2.3, by GitHub Actions; or npm run package)
              npm run build ──► apps/studio/dist/  (git-ignored build output)
                    │
                    ▼ scripts/package.mjs
              release/worldraft-1.2.3.zip = dist + backend/src + uv.lock + start.sh/.cmd + README
                    │
                    ▼ attached to the GitHub Release
 user downloads zip ──► start.cmd / sh start.sh ──► uv run --locked worldraft ──► one process on :8000
```

Users never build anything. The build runs once, on the developer's or CI's
machine, and the resulting static files travel inside the zip. The zip is
platform-independent: it contains no compiled Python packages; `uv` installs
the right wheels for the user's OS from `uv.lock` on first start.

### Cutting a release

1. Bump `"version"` in `package.json` (and `backend/pyproject.toml` if you keep
   them in sync), commit.
2. `git tag v<version> && git push --tags`.
3. `.github/workflows/release.yml` builds, tests, packages, smoke-tests the zip
   as a user (no Node on PATH) and attaches it to a GitHub Release.

Locally, `npm run package` produces the same zip in `release/` (git-ignored),
which is the quickest way to test user mode: unzip it somewhere else and run
`sh start.sh` / `start.cmd`.

### Why a Release zip instead of "clone and run start"?

Committing build output to git bloats history and drifts from source; asking
users to clone means asking them to install git and Node. A Release is a
single download with nothing to compile. A developer who *does* want user mode
from a checkout can run `npm run build` once; `start` then finds
`apps/studio/dist` and works.

## What `npm run setup` does

`scripts/setup.mjs` has no npm dependencies, so it runs before anything is
installed. It performs three things, in order, and stops at the first failure:

1. **Tools** (`TOOLS` array): checks that Node.js satisfies
   `package.json#engines.node` and that `uv` is on `PATH`. It **never installs
   a runtime**; it prints the official install hint for the current OS and
   exits with code 1.
2. **Dependency sets** (`DEPENDENCY_SETS` array): for each set it hashes the
   set's *inputs* (lockfile, manifests, platform, Node major). If the hash
   matches the stamp written after the last successful install **and** a quick
   verification passes, the set is skipped. Otherwise it runs the locked
   installer (`npm ci`, `uv sync --locked`) with live output, re-verifies, and
   writes the stamp.
3. **Report**: one line per item, `OK` / `INSTALL` / `MISSING`.

`npm run dev` calls the same code before launching services, so a fresh clone
works with a single command, and repeat launches cost about two seconds and
need no network. `npm run setup -- --check` reports without installing;
`--force` reinstalls everything from the lockfiles.

Stamps live *inside* the installed directories
(`node_modules/.worldraft-setup-stamp.json`,
`backend/.venv/.worldraft-setup-stamp.json`), so deleting the directory also
deletes the stamp. Both directories are git-ignored.

### Python interpreters

`uv sync` uses the interpreter requested by `backend/.python-version`. If the
machine has none, uv downloads a managed CPython into its own cache directory
(`uv python dir`). It never modifies a system Python or `PATH`. To forbid this
on a given machine, set `UV_PYTHON_DOWNLOADS=never`.

### Security posture (keep it this way)

- No `curl | sh`, no runtime installers executed by scripts; links only.
- Only lockfile installs: `npm ci`, `uv sync --locked`. Changing dependencies
  is a deliberate act (see below) that updates a lockfile in a reviewable diff.
- Subprocesses are spawned with argument arrays, not shell strings. npm is run
  as `node npm-cli.js` so `.cmd` shims are never involved on Windows.
- Services bind `127.0.0.1` only. The launcher does not read `.env` files and
  disables LangSmith tracing.

## Day-to-day: changing dependencies

You never edit the setup script for this. Change a lockfile and the next
`npm run dev` or `npm run setup` re-installs that set.

| Task | Command (from the repository root) |
| --- | --- |
| Add/upgrade a Python package | `uv add --project backend fastapi==0.162.0` |
| Add a Python dev-only package | `uv add --project backend --dev pytest` |
| Remove a Python package | `uv remove --project backend name` |
| Add/upgrade a frontend package | `npm install vite@8.3.5 --workspace @worldraft/studio` |
| Add a frontend dev-only package | `npm install -D name --workspace @worldraft/studio` |
| Add a root-level tool (scripts only) | `npm install -D name` |
| Refresh every lockfile after editing manifests by hand | `npm install` and `uv lock --project backend` |

Commit `package-lock.json` and `backend/uv.lock` together with the manifest.
Everyone else picks up the change automatically on their next launch.

Pinned runtime versions: `package.json#engines.node` (enforced), `.nvmrc`
(advisory, for nvm users), `backend/.python-version` (used by uv).

## Extending the setup script

Open `scripts/setup.mjs`. There are exactly two extension points.

### Adding a required tool (something the user must install)

Append to `TOOLS`. `check` returns a short version string or throws an
`Error` whose message is the complete fix instruction:

```js
{
  name: "Blender",
  check({ env }) {
    const result = spawnSync("blender", ["--version"], { env, encoding: "utf8" });
    if (result.error || result.status !== 0)
      throw new Error("Blender is missing from PATH. Install 4.2+ from https://www.blender.org/download/ and restart your terminal.");
    return result.stdout.split("\n")[0];
  },
},
```

Rules: detect, never install; say where to get it; keep the check under a
second. If a tool is only needed for some workflows, make it optional: return
`"not found (optional)"` instead of throwing, and let the feature that needs it
report the absence at use time.

### Adding a dependency set (something the script installs from a lockfile)

Append to `DEPENDENCY_SETS`:

```js
{
  name: "assets (git-lfs)",
  inputs: ["assets/manifest.json"],               // what decides "needs reinstall"
  stamp: "assets/.cache/.worldraft-setup-stamp.json", // inside the installed dir
  extra: () => ({ platform: process.platform }),  // optional, folded into the hash
  verify: ({ root }) => existsSync(path.join(root, "assets/.cache/ready")),
  install: ({ root, env }) => runStreaming({ command: "tool", args: ["fetch"] }, { cwd: root, env }),
  fix: "tool fetch",                              // shown by --check
},
```

Rules: `inputs` must be files committed to git; `verify` must be fast and must
not touch the network; `install` must be idempotent and must use a lockfile or
a pinned manifest. Add a line to the table in `scripts/setup.test.mjs` if you
want the contract test to cover a new required field.

### Adding a file the user needs at runtime

If a new feature ships data files, templates or models alongside the code,
add them to `RELEASE_CONTENTS` in `scripts/package.mjs` (and to
`scripts/package.test.mjs`'s fake repository). Anything not listed there is not
in the zip: tests, `node_modules`, `.env`, caches and bytecode are excluded by
construction.

### Configuration: who reads what

| Program | Reads `.env`? | Reads the environment? | Variables |
| --- | --- | --- | --- |
| Backend app (`studio.settings`), in dev **and** user mode | yes | yes (wins on conflict) | `WORLDRAFT_*` |
| Developer launcher (`scripts/dev.mjs`) | **no** (warns if it finds its names there) | yes | `API_PORT`, `UI_PORT`, `NO_OPEN`, `DEV_STARTUP_TIMEOUT_MS`, `BROWSER` |
| Frontend build (`vite build`) | no | yes, at build time | `VITE_API_URL` |

Precedence for the backend: environment > `.env` > default in `settings.py`.
`.env` lives next to `backend/` (project root, or the unzipped release
folder), is git-ignored and is never packaged; `.env.example` is the template.

Consequences worth knowing: `WORLDRAFT_PORT` and `WORLDRAFT_UI_DIR` only
matter in user mode (in dev mode the launcher picks the ports); a setting such
as `WORLDRAFT_CORS_ORIGINS` applies in both modes because the backend process
reads it. The launcher deliberately ignores `.env` so a file cannot change
which ports the developer tooling binds without the developer seeing it; it
prints a note if `.env` contains one of its variables.

### Adding a setting

- **Application setting** (`WORLDRAFT_*`): add a typed field with a safe
  default to `Settings` in `backend/src/studio/settings.py`, document it in
  `.env.example`, read it via `get_settings()` (or `app.state.settings`).
  Never put a secret in a default; users put secrets in `.env`.
- **Launcher variable**: read and validate it in `readConfig()` in
  `scripts/dev.mjs`, add its name to `LAUNCHER_VARIABLES` (so the `.env`
  warning covers it), and list it in `.env.example`'s reference block.
- Frontend build-time configuration is `VITE_API_URL` only (see
  [deployment.md](deployment.md)); call the API through `apiUrl()` so it applies.

### The wrappers (`start.*`, `dev.*`)

They are deliberately dumb: change directory, check that one tool exists,
hand off. `start.*` checks `uv`; `dev.*` checks `node` (and, on POSIX, loads
nvm to *activate* the `.nvmrc` version if `node` is absent; it never runs
`nvm install`). All real logic lives in `scripts/setup.mjs`, `scripts/dev.mjs`
and `studio/serve.py`, so the wrappers should not need edits as the project
grows.

## Shutdown and port hygiene (developer mode)

`scripts/dev.mjs` starts uvicorn and Vite in their own process groups so the
whole tree can be signalled. Consequences and how they are handled:

| Event | What happens |
| --- | --- |
| Ctrl+C | SIGTERM to both groups, wait up to 3 s, SIGKILL stragglers, remove the registry. |
| Ctrl+C again while stopping | SIGKILL immediately. |
| Terminal tab closed / IDE "kill terminal" (SIGHUP) | Same as Ctrl+C. |
| Launcher exits for any other reason | A synchronous `exit` guard SIGKILLs live groups. |
| Launcher was SIGKILLed (nothing can run) | Next launch reads `.worldraft/dev-services.json`, confirms each recorded PID still runs the recorded command, stops those, and proceeds. Unrelated processes on the port are never touched. |

If a port is still busy after that, it is not ours: the message says so and
nothing is killed. User mode is a single process and needs none of this.

## Verifying a change to the setup tooling

```sh
npm test                       # offline unit tests: setup, package, launcher, backend (incl. serve)
npm run test:integration       # real services on free ports
rm -rf node_modules backend/.venv && npm run dev   # fresh-clone developer path
PATH=/nonexistent $(which node) scripts/setup.mjs --check   # failure messaging
npm run package && cd /tmp && unzip -o <repo>/release/worldraft-*.zip && cd worldraft-* && sh start.sh   # user path
```

On Windows PowerShell, the last line is
`$env:PATH=""; node scripts/setup.mjs --check`.
