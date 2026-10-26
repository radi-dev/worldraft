#!/bin/sh
# Worldraft — run the app (user mode). Needs only uv; no Node.js, no Python setup.
# Usage: sh start.sh [--port 8010] [--no-open]
set -e
cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  # Fresh uv installs land here but the terminal may predate the PATH change.
  if [ -x "$HOME/.local/bin/uv" ]; then
    PATH="$HOME/.local/bin:$PATH"
  else
    echo "uv is not installed (or not on PATH)."
    echo "Install it from https://docs.astral.sh/uv/getting-started/installation/"
    echo "  macOS (Homebrew): brew install uv"
    echo "then open a new terminal and run this again."
    exit 1
  fi
fi

# First run installs the locked backend dependencies (and a private Python if
# needed) into backend/.venv. Later runs start immediately.
exec uv run --project backend --locked --no-dev worldraft "$@"
