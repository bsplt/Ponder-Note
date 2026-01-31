#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="$ROOT_DIR/app"

if ! command -v nix >/dev/null 2>&1; then
  echo "Error: nix is not installed or not on PATH." >&2
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Error: app directory not found at $APP_DIR" >&2
  exit 1
fi

nix --extra-experimental-features "nix-command flakes" develop "$ROOT_DIR" -c bash -c \
  'cd "$1" && pnpm install && pnpm tauri build "${@:2}"' bash "$APP_DIR" "$@"
