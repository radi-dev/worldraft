# Worldraft — Getting started

Worldraft runs entirely on your computer. Nothing is sent anywhere unless a
feature says so explicitly. This guide is for running the app; to change the
code, see the developer notes in the repository README.

## 1. Install uv (once)

uv is a small, single-file tool that prepares the Python side for you. You do
not need to install Python yourself.

- **Windows**: open *PowerShell* and run `winget install --id=astral-sh.uv -e`
- **macOS**: with Homebrew, `brew install uv`
- **Any system**: follow <https://docs.astral.sh/uv/getting-started/installation/>

Close and reopen your terminal afterwards.

## 2. Get Worldraft

Download the latest `worldraft-<version>.zip` from the project's
**Releases** page on GitHub and unzip it anywhere you like. The zip already
contains the built app; there is nothing to compile.

## 3. Start it

- **Windows**: double-click `start.cmd` (or run it from a terminal).
- **macOS / Linux**: open a terminal in the unzipped folder and run `sh start.sh`.

The first start downloads the app's dependencies (about a minute; needs
internet). After that, starting takes a few seconds and works offline.
Your browser opens at <http://127.0.0.1:8000>. Leave the terminal window open
while you use the app; press **Ctrl+C** in it (or close it) to stop.

## Options

| Need | Do this |
| --- | --- |
| Another port | `start.cmd --port 8010` / `sh start.sh --port 8010`, or create a file named `.env` in this folder containing `WORLDRAFT_PORT=8010` |
| Other settings | Create `.env` in this folder; see the included `.env.example` for the list. Environment variables take precedence over the file. |
| Don't open a browser | add `--no-open` |
| Update to a new version | unzip the new release over a new folder; run `start` again |
| Remove everything | delete the folder. To also remove uv's downloaded Python: `uv python uninstall --all` |

## Troubleshooting

| Message | What to do |
| --- | --- |
| `uv is not installed` | Do step 1, then open a **new** terminal window. |
| `Port 8000 is already in use` | Something else uses that port; use `--port 8010`. |
| `No built UI at ...` | You have a source checkout, not a release. Download a release zip, or (developers) run `npm run build`. |
| Browser didn't open | Open <http://127.0.0.1:8000> yourself. |
| Blank 3D view | Use a browser with WebGL 2 and hardware acceleration enabled. |

What the first start does, for the curious: `uv` reads `backend/uv.lock`, a
list of exact package versions with checksums, installs them into a private
folder `backend/.venv`, and if your system has no suitable Python it downloads
one into uv's own cache. It never changes your system Python or your PATH.
