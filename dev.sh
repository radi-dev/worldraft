#!/bin/sh
# Worldraft — developer mode (Vite + uvicorn with hot reload). Needs Node.js 22 and uv.
# Equivalent to `npm run dev`, plus: activates Node through nvm when node is not on PATH.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$NVM_SH" ]; then
    # nvm is a shell function; load it, then select the version from .nvmrc.
    # This only activates an installed Node; it never downloads one.
    . "$NVM_SH"
    if ! nvm use >/dev/null 2>&1; then
      echo "nvm found, but Node $(cat .nvmrc) is not installed. Run:  nvm install $(cat .nvmrc)"
      exit 1
    fi
  else
    echo "Node.js is not installed (or not on PATH)."
    echo "Install Node.js 22 LTS from https://nodejs.org/ (or with nvm: nvm install 22),"
    echo "then open a new terminal and run this again."
    exit 1
  fi
fi

exec npm run dev -- "$@"
