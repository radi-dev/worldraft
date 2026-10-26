"""User-mode launcher: one process serving the API and the prebuilt UI.

Started by the `start.sh` / `start.cmd` wrappers through
`uv run --project backend worldraft`. Needs no Node.js: the UI must already be
built (`apps/studio/dist`, produced by `npm run build` or shipped in a release).
Binds 127.0.0.1 only, never reloads, opens the browser at most once.
Configuration: `--port`, or WORLDRAFT_PORT / WORLDRAFT_UI_DIR (environment or
`.env`), see studio/settings.py.
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from studio.settings import Settings, get_settings

HOST = "127.0.0.1"


def build_app(ui_dir: Path, settings: Settings | None = None) -> FastAPI:
    """Return the API app with the built UI mounted after every API route."""
    if not (ui_dir / "index.html").is_file():
        raise FileNotFoundError(
            f"No built UI at {ui_dir}. Download a release, which includes it, "
            "or (developers) run `npm run build` first. Set WORLDRAFT_UI_DIR to "
            "use a different folder."
        )
    from studio.main import create_app

    app = create_app(settings)
    app.mount("/", StaticFiles(directory=str(ui_dir), html=True), name="ui")
    return app


def port_is_free(port: int, host: str = HOST) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind((host, port))
        except OSError:
            return False
    return True


def read_port(settings: Settings, override: int | None = None) -> int:
    port = settings.port if override is None else override
    if not 1024 <= port <= 65535:
        raise ValueError("--port / WORLDRAFT_PORT must be an integer from 1024 to 65535.")
    return port


def open_browser_when_ready(url: str, timeout_s: float = 30.0) -> None:
    """Poll the health route, then ask the OS to open the UI once."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as response:
                if response.status == 200:
                    break
        except Exception:  # noqa: BLE001 - service not up yet
            time.sleep(0.2)
    else:
        print(f"[worldraft] Could not confirm readiness; open {url} manually.", flush=True)
        return
    if not webbrowser.open(url, new=2):
        print(f"[worldraft] Could not open a browser; open {url} manually.", flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="worldraft", description="Run Worldraft (API + built UI) locally."
    )
    parser.add_argument("--port", type=int, help="port to listen on (default: WORLDRAFT_PORT or 8000)")
    parser.add_argument("--no-open", action="store_true", help="do not open a browser")
    args = parser.parse_args(argv)

    try:
        settings = get_settings()
        port = read_port(settings, override=args.port)
        ui_dir = settings.ui_dir
        app = build_app(ui_dir, settings)
    except (ValueError, FileNotFoundError) as error:
        print(f"[worldraft] {error}", file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001 - e.g. a malformed .env value
        print(f"[worldraft] Invalid configuration: {error}", file=sys.stderr)
        return 1
    if not port_is_free(port):
        print(
            f"[worldraft] Port {port} is already in use. Stop the other program or "
            "run again with --port <free port>. Nothing was stopped.",
            file=sys.stderr,
        )
        return 1

    import uvicorn

    url = f"http://{HOST}:{port}"
    print(f"[worldraft] Serving UI from {ui_dir}", flush=True)
    print(f"[worldraft] Open {url}  ·  Ctrl+C stops the app", flush=True)
    if not args.no_open and os.environ.get("NO_OPEN") != "1":
        threading.Thread(target=open_browser_when_ready, args=(url,), daemon=True).start()
    uvicorn.run(app, host=HOST, port=port, log_level=settings.log_level)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
