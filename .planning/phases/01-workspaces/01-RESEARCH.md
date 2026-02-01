# Phase 01: Workspaces - Research

**Researched:** 2026-01-30
**Domain:** Tauri (macOS) workspace selection + slot switching + persisted config + root-level note discovery
**Confidence:** MEDIUM

## Summary

Phase 01 is primarily about (1) a persisted *workspace slots* config (1-9 + active slot), (2) a workspaces management UI, and (3) fast switching behavior from the overview via number keys. The “standard” implementation for Tauri apps is: keep all filesystem + config I/O in Rust behind a small set of `#[tauri::command]` entrypoints, and use a native dialog plugin for folder picking so the renderer does not need broad filesystem permissions.

For persistence, the locked requirement is a per-user global config file `config.json` stored under the OS app config directory (macOS: under `~/Library/Application Support/<AppName>/`). Use the `platform-dirs` crate (`AppDirs::new(Some("Ponder"), false)`) to compute the config directory and create it on demand. Write config updates atomically.

The workspace itself stays file-first: only `*.md` files in the workspace root are considered notes, and anything under `<workspace>/.ponder/` and `<workspace>/deleted/` is out of scope (root-only scanning makes this naturally true, but enforce it explicitly if/when any recursion is introduced later).

**Primary recommendation:** implement a `WorkspaceService` in Rust that owns slot config + path validation + root-only note listing, expose it via commands, and have the UI treat the config as server-owned state.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| Tauri | 2.9.x | Desktop shell + IPC | Current stable v2 line; capability-based permissions model. |
| Rust | >= 1.77.2 | Trusted core (config + filesystem) | Required baseline for Tauri v2 plugins; best place for file IO invariants. |
| serde / serde_json | 1.x | Config serialization | Standard Rust JSON serialization/de-serialization. |
| platform-dirs | 0.3.0 | Per-user config dir resolution | Small, cross-platform, returns macOS `Application Support/<name>` paths when `use_xdg_on_macos=false`. |
| tauri-plugin-dialog | 2.6.x | Folder picker + confirmation dialogs | First-party plugin; supports file dialogs on macOS and JS `open({ directory: true })`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| tauri (PathResolver) | 2.9.x | Alternate app path resolution | Use only if you later drop the `platform-dirs` requirement; `app.path().app_config_dir()` exists. |
| thiserror | 2.x | Typed error surface | Use for clean error mapping to UI (missing/unreadable/permission denied). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| `platform-dirs` for config path | `tauri::path::PathResolver::app_config_dir()` | Conflicts with the locked requirement to use PlatformDirs-derived paths. |
| JS dialog plugin for confirm | Custom modal | Hand-rolled modal is fine, but native confirm dialogs are consistent and already available via dialog plugin (`confirm`). |

**Installation (when the app scaffold exists):**
```bash
# rust
cargo add serde serde_json thiserror
cargo add platform-dirs@0.3.0
cargo add tauri-plugin-dialog@2.6.0

# js
npm install @tauri-apps/plugin-dialog
```

## Architecture Patterns

### Recommended Project Structure (Phase 01 scope)
Keep workspace + config concerns in Rust services and expose minimal commands.

```
src-tauri/
├── src/
│   ├── main.rs
│   ├── commands/
│   │   └── workspace.rs          # list_slots, assign_slot, switch_slot, list_root_notes
│   ├── services/
│   │   └── workspace_service.rs  # owns config + path validation
│   ├── storage/
│   │   └── app_config_repo.rs    # read/write config.json atomically
│   └── domain/
│       └── workspace.rs          # slot types + DTOs
└── tauri.conf.json

src/
├── app/
├── screens/
│   ├── Overview.tsx              # key handling for 1-9
│   └── Workspaces.tsx            # slot list + assign/reassign
├── api/
│   └── workspace.ts              # typed invoke wrappers
└── stores/
    └── workspaceStore.ts         # active slot + slot list + error states
```

### Pattern 1: Rust-Owned Config (single source of truth)
**What:** UI reads config via command, writes updates via command; Rust persists `config.json` atomically.

**When to use:** Always for workspace slots + last active slot persistence.

**Why:** Avoids split-brain state across JS and Rust and keeps sensitive path handling centralized.

**Example (Rust):**
```rust
// Source: https://docs.rs/platform-dirs/0.3.0/platform_dirs/struct.AppDirs.html
//         https://docs.rs/serde_json/latest/serde_json/
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
  pub workspaces: [Option<String>; 9],
  pub active_slot: u8, // 1..=9
}

impl Default for AppConfig {
  fn default() -> Self {
    Self { workspaces: Default::default(), active_slot: 1 }
  }
}

fn config_path() -> anyhow::Result<PathBuf> {
  let dirs = platform_dirs::AppDirs::new(Some("Ponder"), false)
    .ok_or_else(|| anyhow::anyhow!("no app dirs"))?;
  Ok(dirs.config_dir.join("config.json"))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
  // Minimal, cross-platform atomic write pattern: write temp in same dir then rename.
  // (For Phase 01 planning: make this a shared utility used by config writes.)
  let dir = path.parent().unwrap();
  std::fs::create_dir_all(dir)?;
  let tmp = dir.join(format!(".{}.tmp", path.file_name().unwrap().to_string_lossy()));
  std::fs::write(&tmp, bytes)?;
  std::fs::rename(tmp, path)?;
  Ok(())
}
```

### Pattern 2: “Validate then switch” slot transitions
**What:** Switching slots is a command that validates the target path at switch-time; unassigned routes to Workspaces; missing/unreadable sets an error state.

**When to use:** On overview number-key shortcuts and on app startup restore.

**Key details (from phase decisions):**
- Assigning to a slot immediately switches active slot.
- Pressing key for unassigned slot opens Workspaces screen.
- Non-active slots are not proactively checked.
- Relaunch missing/unreadable: open Workspaces, mark that slot error; highlight first valid assigned slot as fallback selection.

### Anti-Patterns to Avoid
- **Renderer reads workspace filesystem directly:** pushes capability surface into JS, duplicates validation logic.
- **Treat stored slot paths as always valid:** always validate at startup and switch-time; surface permission errors distinctly.
- **Global keybind for 1-9:** requirement is “overview only”; keep it scoped to the overview route/component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Folder picker | Custom HTML file input hacks | `tauri-plugin-dialog` `open({ directory: true })` | Native UX; avoids webview sandbox limitations; standard Tauri approach. |
| Per-user config directories | Hardcoded `~/Library/...` strings | `platform-dirs` `AppDirs` | Correct per-platform resolution; avoids path mistakes. |
| IPC access control | “Just expose commands” without capabilities | Tauri v2 capabilities + plugin permissions | Tauri v2 denies IPC without a matching capability; required for production-like setup. |

**Key insight:** Phase 01 feels “UI-only”, but it is a trust boundary: it determines what folders the app will read/write forever. Centralize it in Rust and keep permission/capability wiring explicit.

## Common Pitfalls

### Pitfall 1: macOS folder access fails after relaunch (sandbox/distribution mismatch)
**What goes wrong:** Folder works once, but after restart the app cannot read it (or users see empty notes).

**Why it happens:** If the app is sandboxed or adopts hardened restrictions, macOS may require persistent security-scoped bookmarks for arbitrary folders.

**How to avoid (Phase 01 planning):**
- Decide early whether initial builds are sandboxed. If not sandboxed (typical DMG/not-App-Store dev), standard filesystem access applies.
- If sandboxing is planned, you will need a persistent access strategy (do not delay this decision until after you ship to testers).

**Warning signs:** Works for dev builds but fails for packaged builds; only some directories fail (e.g., Desktop/Documents restrictions).

**Related gotcha:** In sandboxed environments, “atomic replace” strategies (tempfile + rename over existing file) can fail even when creating new files works. A practical workaround is falling back to an in-place write (`truncate + write + sync`) or remove-then-persist when overwriting existing notes.

**Confidence:** LOW (needs validation against the intended distribution model).

### Pitfall 2: Slot paths drift (duplicates, symlinks, casing)
**What goes wrong:** Same folder appears multiple times; switching logic behaves inconsistently across restarts.

**Why it happens:** Storing raw strings without canonicalization allows symlinked paths and differing representations.

**How to avoid:**
- On assignment, store an absolute, canonicalized path when possible (e.g., `std::fs::canonicalize`).
- Treat symlinks explicitly: for Phase 01, recommend “do not follow symlinks when scanning” (root-only makes this trivial).

**Confidence:** MEDIUM.

### Pitfall 3: Keyboard shortcuts trigger while typing
**What goes wrong:** User types “1” in a search box and suddenly switches workspaces.

**How to avoid:**
- Only attach the key handler while the overview screen is active.
- Ignore key events from inputs/textarea/contenteditable.
- Treat `event.repeat` as a no-op.

**Confidence:** HIGH.

### Pitfall 4: Root-only note scan accidentally includes reserved folders later
**What goes wrong:** A future “recursive scan” inadvertently indexes `.ponder/` or `deleted/` notes.

**How to avoid:**
- Encode exclusion rules in a single place (scanner function) and keep them even if Phase 01 is root-only.

**Confidence:** HIGH.

## Code Examples

### 1) Pick a workspace folder from the Workspaces screen
```ts
// Source: https://tauri.app/plugin/dialog/
import { open } from '@tauri-apps/plugin-dialog'

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false })
  if (typeof selected === 'string') return selected
  return null
}
```

### 2) Overview-only number key switching (React)
```tsx
// Source: project phase decision (overview-only), plus standard DOM key handling
import { useEffect } from 'react'

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export function useWorkspaceNumberShortcuts(onSlot: (slot: number) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (e.key.length !== 1) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > 9) return
      e.preventDefault()
      onSlot(n)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSlot])
}
```

### 3) Root-level `*.md` note listing (Rust)
```rust
// Source: standard library `std::fs::read_dir` usage
use std::path::{Path, PathBuf};

pub fn list_root_markdown_notes(workspace_root: &Path) -> std::io::Result<Vec<PathBuf>> {
  let mut notes = Vec::new();
  for entry in std::fs::read_dir(workspace_root)? {
    let entry = entry?;
    let path = entry.path();
    let ty = entry.file_type()?;
    if !ty.is_file() {
      continue;
    }
    if path.extension().and_then(|s| s.to_str()) != Some("md") {
      continue;
    }
    notes.push(path);
  }
  notes.sort();
  Ok(notes)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| “Renderer can call any command” | Tauri v2 capability-based IPC access control | Tauri v2 | If a window/webview matches no capability, it has no IPC access. Plan early for capability files + permissions. |
| Custom native bindings for dialogs | First-party plugin dialogs | Tauri v2 plugin ecosystem | Faster setup; consistent permission identifiers (`dialog:*`). |

**Deprecated/outdated:**
- Treating Tauri v1 event/command behavior as sufficient for v2 security; v2 has a stricter capability model.

## Open Questions

1. **Distribution model for early builds (sandboxed or not?)**
   - What we know: macOS sandboxing can require persistent folder access grants.
   - What's unclear: whether Ponder will ship as a sandboxed build in the near term.
   - Recommendation: plan Phase 01 assuming non-sandboxed dev/DMG, but add a task to explicitly decide sandboxing before inviting external testers.

2. **Exact permission identifiers for dialog plugin in capability files**
   - What we know: dialog plugin exposes granular permissions (e.g., `dialog:allow-open`) and a default permission set.
   - What's unclear: whether your generated capability JSON should reference `dialog:open` vs `dialog:allow-open` in this repo’s scaffold.
   - Recommendation: rely on `tauri add dialog` during scaffold to generate correct permission entries; avoid manual guessing.

## Sources

### Primary (HIGH confidence)
- https://tauri.app/plugin/dialog/ — Dialog plugin setup/usage + permission table
- https://docs.rs/tauri-plugin-dialog/2.6.0/tauri_plugin_dialog/ — Plugin API surface + dependencies
- https://docs.rs/platform-dirs/0.3.0/platform_dirs/struct.AppDirs.html — App config dir resolution API
- https://docs.rs/platform-dirs/0.3.0/src/platform_dirs/lib.rs.html — macOS path behavior when `use_xdg_on_macos=false`
- https://docs.rs/tauri/2.9.5/tauri/path/struct.PathResolver.html — `app_config_dir()` and related path APIs (alternative, not selected)

### Secondary (MEDIUM confidence)
- https://v2.tauri.app/reference/acl/capability/ — Capability schema and example (note: verify exact permission identifiers against generated scaffold)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and APIs verified via docs.rs + official Tauri docs.
- Architecture: MEDIUM - patterns are standard for Tauri apps; exact command names and file layout are project-specific.
- Pitfalls: MEDIUM - general macOS + local-folder app pitfalls; sandbox details depend on distribution choice.

**Research date:** 2026-01-30
**Valid until:** 2026-02-06 (capability/permission docs can change; re-check during scaffold)
