#!/usr/bin/env zsh
set -euo pipefail
setopt KSH_ARRAYS

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/App.app" >&2
  exit 1
fi

APP_BUNDLE=$1

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "Error: app bundle not found at $APP_BUNDLE" >&2
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Skipping dylib vendoring outside macOS."
  exit 0
fi

APP_BUNDLE=$(cd "$APP_BUNDLE" && pwd)
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
FRAMEWORKS_DIR="$CONTENTS_DIR/Frameworks"

mkdir -p "$FRAMEWORKS_DIR"

main_executable=""
while IFS= read -r candidate; do
  if [[ -f "$candidate" && -x "$candidate" ]]; then
    main_executable=$candidate
    break
  fi
done < <(find "$MACOS_DIR" -maxdepth 1 -type f | sort)

if [[ -z "$main_executable" ]]; then
  echo "Error: could not find app executable in $MACOS_DIR" >&2
  exit 1
fi

typeset -A seen_sources=()
typeset -A bundled_names=()
typeset -A queued=()
typeset -a worklist=()

is_system_dependency() {
  local dep=$1
  [[ "$dep" == @* ]] && return 0
  [[ "$dep" == /System/* ]] && return 0
  [[ "$dep" == /usr/lib/* ]] && return 0
  return 1
}

is_within_bundle() {
  local dep=$1
  [[ "$dep" == "$APP_BUNDLE"/* ]]
}

bundle_name_for_path() {
  basename "$1"
}

queue_binary() {
  local binary=$1
  if [[ -n "${queued[$binary]:-}" ]]; then
    return
  fi
  queued[$binary]=1
  worklist+=("$binary")
}

copy_dependency() {
  local source_path=$1
  local bundle_name
  local dest_path

  if ! [[ -f "$source_path" ]]; then
    echo "Error: dependency not found at $source_path" >&2
    exit 1
  fi

  bundle_name=$(bundle_name_for_path "$source_path")
  dest_path="$FRAMEWORKS_DIR/$bundle_name"

  if [[ -n "${seen_sources[$source_path]:-}" ]]; then
    echo "$dest_path"
    return
  fi

  if [[ -n "${bundled_names[$bundle_name]:-}" && "${bundled_names[$bundle_name]}" != "$source_path" ]]; then
    echo "Error: dependency name collision for $bundle_name" >&2
    echo "  existing: ${bundled_names[$bundle_name]}" >&2
    echo "  new:      $source_path" >&2
    exit 1
  fi

  cp "$source_path" "$dest_path"
  chmod u+w "$dest_path"
  install_name_tool -id "@rpath/$bundle_name" "$dest_path"

  seen_sources[$source_path]=$dest_path
  bundled_names[$bundle_name]=$source_path

  queue_binary "$dest_path"
  echo "$dest_path"
}

list_dependencies() {
  local binary=$1
  otool -L "$binary" | tail -n +2 | awk '{print $1}'
}

rewrite_binary_dependencies() {
  local binary=$1
  local binary_dir
  local dep
  local rewritten_path
  local bundle_name

  binary_dir=$(dirname "$binary")

  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue

    if is_system_dependency "$dep" || is_within_bundle "$dep"; then
      continue
    fi

    if [[ "$dep" != /* ]]; then
      echo "Error: unsupported dependency path '$dep' in $binary" >&2
      exit 1
    fi

    copy_dependency "$dep" >/dev/null
    bundle_name=$(bundle_name_for_path "$dep")

    if [[ "$binary_dir" == "$FRAMEWORKS_DIR" ]]; then
      rewritten_path="@loader_path/$bundle_name"
    else
      rewritten_path="@executable_path/../Frameworks/$bundle_name"
    fi

    install_name_tool -change "$dep" "$rewritten_path" "$binary"
  done < <(list_dependencies "$binary")
}

queue_binary "$main_executable"

index=0
while (( index < ${#worklist[@]} )); do
  rewrite_binary_dependencies "${worklist[$index]}"
  ((index += 1))
done

while IFS= read -r vendored_binary; do
  [[ -z "$vendored_binary" ]] && continue
  codesign --force --sign - --timestamp=none "$vendored_binary"
done < <(find "$FRAMEWORKS_DIR" -type f | sort)

codesign --force --sign - --timestamp=none --deep "$APP_BUNDLE"

violations=()
while IFS= read -r binary; do
  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue
    if is_system_dependency "$dep"; then
      continue
    fi
    if is_within_bundle "$dep"; then
      continue
    fi
    violations+=("$binary -> $dep")
  done < <(list_dependencies "$binary")
done < <(find "$MACOS_DIR" "$FRAMEWORKS_DIR" -type f | sort)

if (( ${#violations[@]} > 0 )); then
  echo "Error: app bundle still references external dynamic libraries:" >&2
  printf '  %s\n' "${violations[@]}" >&2
  exit 1
fi

codesign --verify --deep --strict "$APP_BUNDLE"
echo "Vendored external dylibs into $FRAMEWORKS_DIR"
