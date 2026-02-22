# Phase 03: Overview <-> Editor Loop - Research

**Researched:** 2026-01-31
**Domain:** Tauri v2 desktop note editor loop (React + Rust)
**Confidence:** HIGH

## Summary

This research focused on implementing the overview-to-editor flow in a Tauri v2 + React app with autosave, undo/redo, safe writes, and a deterministic exit path that rewrites `o ` checklist lines. The project already uses Tauri commands for workspace operations; the standard approach is to add new Rust commands for reading and writing note files and keep UI state in React (overview selection, editor content, save state).

For crash-safe writes (SAFE-01), the prescriptive approach is to write to a temporary file in the same directory, sync it, and atomically replace the target file. The Rust `tempfile` crate provides `NamedTempFile::new_in` and `persist` with an atomic replace on supported platforms; `std::fs::rename` is the underlying primitive and is atomic when source and destination are on the same filesystem. Use a debounce in the editor UI and always flush pending writes before leaving the editor.

**Primary recommendation:** Use a Rust command layer for note read/write and implement atomic writes via `tempfile::NamedTempFile::new_in` + `persist`, syncing content before replace.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri | 2.x | Desktop app backend and IPC | Existing app uses Tauri v2 commands for workspace actions |
| @tauri-apps/api | 2.x | Frontend invoke bridge | Official Tauri JS API used in app code |
| React | 19.1.0 | UI state and rendering | Existing frontend stack |
| Vite | 7.0.4 | Frontend build/dev | Existing frontend stack |
| TypeScript | 5.8.3 | Type safety | Existing frontend stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tempfile | 3.24.0 | Atomic write via temp file + persist | Use for SAFE-01 to avoid partial writes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tempfile::NamedTempFile::persist | std::fs::rename with manual temp filename | More error-prone; must manage collision and cleanup yourself |

**Installation:**
```bash
cargo add tempfile
```

## Architecture Patterns

### Recommended Project Structure
```
app/src/
├── screens/
│   ├── Overview.tsx        # list + selection + open logic
│   ├── Editor.tsx          # textarea editor + autosave + exit handling
├── stores/
│   ├── workspaceStore.ts   # existing workspace state
│   └── editorStore.ts      # optional editor state + save status
├── api/
│   ├── workspace.ts        # existing commands
│   └── notes.ts            # new note read/write commands

app/src-tauri/src/
├── commands/
│   ├── workspace.rs        # existing
│   └── notes.rs            # new: open/save/delete note
├── services/
│   ├── workspace_service.rs
│   └── note_service.rs     # new: IO + rewrite + atomic write
```

### Pattern 1: Tauri Commands + Managed State
**What:** Keep file I/O in Rust commands; call from React via `invoke`.
**When to use:** All reads/writes of note files to preserve SAFE-01 and reduce frontend filesystem permission complexity.
**Example:**
```rust
// Source: https://tauri.app/develop/calling-rust/
#[tauri::command]
pub fn read_note(path: String) -> Result<String, String> {
  std::fs::read_to_string(path).map_err(|e| e.to_string())
}
```
```ts
// Source: https://tauri.app/develop/calling-rust/
import { invoke } from '@tauri-apps/api/core'

const body = await invoke<string>('read_note', { path })
```

### Pattern 2: Debounced Autosave With Flush-on-Exit
**What:** Track editor content in React state, debounce writes, and always flush pending writes before leaving the editor.
**When to use:** Always; required by ED-02 and exit guarantees.
**Example:**
```ts
// Source: https://tauri.app/develop/calling-rust/
const pendingRef = useRef<number | null>(null)

useEffect(() => {
  if (pendingRef.current) window.clearTimeout(pendingRef.current)
  pendingRef.current = window.setTimeout(() => {
    void invoke('save_note', { path, body })
  }, 400)
  return () => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current)
  }
}, [body, path])
```

### Pattern 3: Atomic Replace Write
**What:** Write to a temporary file in the same directory and atomically replace the target.
**When to use:** Every autosave and exit-save to satisfy SAFE-01.
**Example:**
```rust
// Source: https://docs.rs/tempfile/latest/tempfile/struct.NamedTempFile.html
use std::io::Write;
use tempfile::NamedTempFile;

fn atomic_write(dir: &std::path::Path, target: &std::path::Path, body: &str) -> std::io::Result<()> {
  let mut tmp = NamedTempFile::new_in(dir)?;
  tmp.write_all(body.as_bytes())?;
  tmp.as_file().sync_all()?; // Source: https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all
  tmp.persist(target)?; // atomic replace, same filesystem
  Ok(())
}
```

### Anti-Patterns to Avoid
- **Direct overwrite with std::fs::write:** violates SAFE-01 because a crash can leave a partial file.
- **Saving on every keystroke:** causes unnecessary IO, higher failure surface, and UI jank.
- **Rewrite `o ` lines without blockquote/fence checks:** corrupts code blocks and quoted text.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic write | Manual temp filename + rename | `tempfile::NamedTempFile::new_in` + `persist` | Handles temp creation and replacement safely; fewer edge cases |
| Undo/redo history | Custom history stack | Native `<textarea>` undo/redo | Browser handles undo/redo reliably for plain text |

**Key insight:** The editor loop is IO-bound and reliability-sensitive; reuse established primitives (`tempfile`, atomic rename) to prevent partial writes and cleanup bugs.

## Common Pitfalls

### Pitfall 1: Lost edits on exit
**What goes wrong:** User hits ESC while a debounced save is pending and content is discarded.
**Why it happens:** Exit handler closes editor without awaiting the last save.
**How to avoid:** Always flush pending save before exit; block navigation until save resolves.
**Warning signs:** Reports of missing last few seconds of edits.

### Pitfall 2: Partial files after crash
**What goes wrong:** File is truncated or partially written after a crash mid-write.
**Why it happens:** Direct write to the target file.
**How to avoid:** Write to temp + sync + atomic replace.
**Warning signs:** Short files or corrupted Markdown after forced quit.

### Pitfall 3: `o ` rewrite corrupts content
**What goes wrong:** Code fences or blockquotes are altered incorrectly.
**Why it happens:** The rewrite logic ignores Markdown structure.
**How to avoid:** Track fenced code block state and skip lines starting with `>`.
**Warning signs:** Users report checkboxes inside fenced code blocks changed.

### Pitfall 4: Focus/selection drift in overview
**What goes wrong:** Returning from editor loses scroll position and selected note.
**Why it happens:** Overview list re-renders without preserving scroll and selection.
**How to avoid:** Store scrollTop and focused note id in state and restore on return.
**Warning signs:** Cursor jumps to top after returning from editor.

## Code Examples

Verified patterns from official sources:

### Tauri command + invoke
```rust
// Source: https://tauri.app/develop/calling-rust/
#[tauri::command]
pub fn my_custom_command() {
  println!("I was invoked from JavaScript!")
}
```
```ts
// Source: https://tauri.app/develop/calling-rust/
import { invoke } from '@tauri-apps/api/core'

invoke('my_custom_command')
```

### Atomic replace using tempfile persist
```rust
// Source: https://docs.rs/tempfile/latest/tempfile/struct.NamedTempFile.html
use std::io::Write;
use tempfile::NamedTempFile;

let mut file = NamedTempFile::new_in(dir)?;
file.write_all(body.as_bytes())?;
file.as_file().sync_all()?; // Source: https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all
file.persist(target_path)?; // atomically replaces existing file
```

### std::fs::rename semantics
```rust
// Source: https://doc.rust-lang.org/std/fs/fn.rename.html
std::fs::rename("from.tmp", "note.md")?; // replaces existing destination
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct file overwrite | Temp file + atomic replace | 2024+ common Rust practice | Prevents partial writes on crash |
| Custom undo/redo | Native textarea undo/redo | Long-standing browser support | Less code, more reliable |

**Deprecated/outdated:**
- Manual temp filename generation without collision handling: easy to race and leave garbage files.

## Open Questions

1. **Should we fsync the containing directory after persist?**
   - What we know: `tempfile::persist` does not sync content or directory; `File::sync_all` is available.
   - What's unclear: Whether directory fsync is needed for this product's durability expectations.
   - Recommendation: Start with file `sync_all` before persist; add directory sync only if durability testing indicates need.

## Sources

### Primary (HIGH confidence)
- https://tauri.app/develop/calling-rust/ - Tauri commands and invoke examples
- https://doc.rust-lang.org/std/fs/fn.rename.html - Atomic replace semantics for rename
- https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all - File sync behavior
- https://docs.rs/tempfile/latest/tempfile/struct.NamedTempFile.html - temp file creation + persist behavior

### Secondary (MEDIUM confidence)
- None

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived from repo dependencies and official docs
- Architecture: HIGH - follows existing workspace service + Tauri command patterns
- Pitfalls: MEDIUM - based on common failure modes in autosave editors

**Research date:** 2026-01-31
**Valid until:** 2026-03-02
