#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="$ROOT_DIR/app"
BUILD_MODE="${PONDER_BUILD_MODE:-debug}"
TAURI_ARGS=()

usage() {
  cat <<'EOF'
Usage: ./build-app.sh [--debug|--release] [-- <tauri build args>]

Defaults:
  --debug (unless PONDER_BUILD_MODE=release)

Examples:
  ./build-app.sh
  ./build-app.sh --release
  ./build-app.sh --release -- --bundles app
EOF
}

while (($# > 0)); do
  case "$1" in
    --debug)
      BUILD_MODE="debug"
      shift
      ;;
    --release)
      BUILD_MODE="release"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      TAURI_ARGS+=("$@")
      break
      ;;
    *)
      TAURI_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ "$BUILD_MODE" != "debug" && "$BUILD_MODE" != "release" ]]; then
  echo "Error: unsupported build mode '$BUILD_MODE'. Use debug or release." >&2
  exit 1
fi

if ! command -v nix >/dev/null 2>&1; then
  echo "Error: nix is not installed or not on PATH." >&2
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Error: app directory not found at $APP_DIR" >&2
  exit 1
fi

echo "Building Ponder in '$BUILD_MODE' mode..."

if ((${#TAURI_ARGS[@]} > 0)); then
  nix --extra-experimental-features "nix-command flakes" develop "$ROOT_DIR" -c bash -c \
    '
      set -euo pipefail

      app_dir="$1"
      mode="$2"
      shift 2

      cd "$app_dir"
      pnpm install

      if [ "$mode" = "release" ]; then
        pnpm tauri build "$@"
        out_dir="$app_dir/src-tauri/target/release/bundle"
      else
        pnpm tauri build --debug "$@"
        out_dir="$app_dir/src-tauri/target/debug/bundle"
      fi

      echo "Build artifacts: $out_dir"
    ' bash "$APP_DIR" "$BUILD_MODE" "${TAURI_ARGS[@]}"
else
  nix --extra-experimental-features "nix-command flakes" develop "$ROOT_DIR" -c bash -c \
    '
      set -euo pipefail

      app_dir="$1"
      mode="$2"

      cd "$app_dir"
      pnpm install

      if [ "$mode" = "release" ]; then
        pnpm tauri build
        out_dir="$app_dir/src-tauri/target/release/bundle"
      else
        pnpm tauri build --debug
        out_dir="$app_dir/src-tauri/target/debug/bundle"
      fi

      echo "Build artifacts: $out_dir"
    ' bash "$APP_DIR" "$BUILD_MODE"
fi
