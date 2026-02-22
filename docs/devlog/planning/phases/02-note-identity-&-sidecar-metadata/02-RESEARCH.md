# Phase 2: Note Identity & Sidecar Metadata - Research

**Researched:** 2026-01-30
**Domain:** File-based note identity, sidecar metadata, and timestamp display
**Confidence:** MEDIUM

## Summary

This phase is best implemented by keeping identity and metadata entirely file-based: note identity comes from filename (UNIX ms), note content stays plain Markdown, and metadata lives in JSON sidecars under `.ponder/meta/`. In this repo, the standard approach is a Tauri (Rust) backend that performs filesystem reads/writes and exposes commands, while the React frontend formats timestamps and displays titles. Use `serde`/`serde_json` for sidecars and `std::fs` for file operations; avoid hand-rolling JSON or file IO behaviors.

The architecture should extend the existing command -> service -> domain pattern in `app/src-tauri` and keep the UI on the current store/API pattern in `app/src`. Title derivation and timestamp display are already defined by phase decisions; implement them deterministically and rebuild sidecars when missing/invalid while preserving unknown fields. Avoid ghost notes by never deriving note lists from sidecars.

**Primary recommendation:** Implement note listing and sidecar rebuild in the Rust service layer using `std::fs` + `serde_json`, and format timestamps in the React UI with `Intl.DateTimeFormat` using the German locale.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri (Rust) | 2.x | Backend command surface + FS access | Existing app architecture uses Tauri commands and services. |
| React | 19.1.x | UI rendering | Current frontend stack. |
| Vite | 7.x | Build/dev tooling | Current frontend tooling. |
| serde + serde_json | 1.x | JSON (de)serialization | Canonical Rust JSON stack. |
| std::fs + std::path | Rust std | File IO and path handling | Official filesystem APIs. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | 2.x | JS invoke layer | Calling backend commands from React. |
| Intl.DateTimeFormat | Built-in | Locale-aware timestamp formatting | German-style date/time display in UI. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sidecar JSON (locked decision) | N/A | Locked by phase decision. |

**Installation:**
```bash
// No new packages required for Phase 2 in the standard stack.
```

## Architecture Patterns

### Recommended Project Structure
```
app/src/
├── api/               # Tauri command wrappers
├── stores/            # Workspace/note state + side effects
└── screens/           # Overview UI rendering

app/src-tauri/src/
├── commands/          # Tauri command endpoints
├── services/          # Workspace/note file operations
└── domain/            # Data structs + errors
```

### Pattern 1: Tauri Command -> Service -> Filesystem
**What:** Commands are thin wrappers around service methods that do filesystem work.
**When to use:** Any new backend action (list notes with metadata, rebuild sidecar, create note).
**Example:**
```rust
// Source: https://docs.rs/tauri/latest/tauri/attr.command.html
#[tauri::command]
fn list_notes() -> Vec<String> {
    // Call service layer that uses std::fs
    vec![]
}
```

### Pattern 2: Sidecar Rebuild With Unknown Field Preservation
**What:** Parse sidecar JSON into a typed struct, but preserve unknown fields by merging with a `serde_json::Value` map.
**When to use:** Missing/invalid sidecars, or when title/created_at must be reconciled with filename.
**Example:**
```rust
// Source: https://docs.rs/serde_json/latest/serde_json/
use serde_json::{Map, Value};

let mut raw: Map<String, Value> = serde_json::from_str(existing_json).unwrap_or_default();
raw.insert("title".into(), Value::String(title));
raw.insert("created_at".into(), Value::Number(created_at.into()));
let updated = Value::Object(raw);
let json = serde_json::to_string_pretty(&updated)?;
```

### Anti-Patterns to Avoid
- **Deriving notes from sidecars:** Creates ghost notes when `.md` is missing.
- **Using file mtime for created_at:** Filename timestamp is the identity source of truth.
- **Dropping unknown JSON fields:** Breaks forward compatibility and manual edits.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing/merging | Manual string parsing | `serde_json` | Avoids invalid JSON handling and type errors. |
| File IO and directories | Custom OS calls | `std::fs` + `std::path` | Cross-platform, standard error handling. |
| Date/time formatting | Manual string templates | `Intl.DateTimeFormat` | Locale-correct formatting and time zone handling. |

**Key insight:** Use standard libs to avoid cross-platform edge cases (encoding, permissions, locale/timezone).

## Common Pitfalls

### Pitfall 1: TOCTOU races when creating sidecars
**What goes wrong:** Existence checks race with writes; sidecar can be clobbered or mis-synced.
**Why it happens:** File existence checked before creation without atomic operation.
**How to avoid:** Use direct writes and handle errors; prefer `create_dir_all` and write-in-place. (See std::fs TOCTOU guidance.)
**Warning signs:** Intermittent missing sidecars or corrupted JSON after rapid edits.

### Pitfall 2: ms vs s timestamp mismatch
**What goes wrong:** Filenames parsed as seconds, displaying dates far in the past/future.
**Why it happens:** Assumptions about UNIX timestamp unit.
**How to avoid:** Parse filename as integer milliseconds and keep `created_at` in ms everywhere.
**Warning signs:** Dates around 1970 or far future.

### Pitfall 3: Title extraction failing on Markdown prefixes
**What goes wrong:** Titles show raw markers (e.g., `#`, `- [ ]`) or become empty.
**Why it happens:** Incomplete stripping per decision rules.
**How to avoid:** Apply ordered normalization: tabs -> spaces, trim, strip heading/list/quote/checkbox prefixes, strip inline formatting.
**Warning signs:** Titles render as `#` or include checkbox markup.

### Pitfall 4: Ghost notes from orphan sidecars
**What goes wrong:** UI shows notes that only exist as `.json` files.
**Why it happens:** Listing logic reads `.ponder/meta` rather than workspace root.
**How to avoid:** Always list notes from `<workspace>/*.md`; treat sidecars as supplemental only.
**Warning signs:** Note entries missing on disk.

## Code Examples

Verified patterns from official sources:

### Read/write JSON sidecar (Rust)
```rust
// Source: https://docs.rs/serde_json/latest/serde_json/
let meta = serde_json::from_str::<serde_json::Value>(&json_string)?;
let json = serde_json::to_string_pretty(&meta)?;
```

### Create metadata directory + read note text (Rust)
```rust
// Source: https://doc.rust-lang.org/std/fs/index.html
std::fs::create_dir_all(meta_dir)?;
let contents = std::fs::read_to_string(note_path)?;
```

### German-style timestamp formatting (JS)
```ts
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
const dateOnly = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Markdown frontmatter | Sidecar JSON in `.ponder/meta/` | Phase 2 decision | Keeps note files clean while enabling rebuildable metadata. |

**Deprecated/outdated:**
- Editing note content to store metadata: replaced by sidecar JSON (per phase decision).

## Open Questions

1. **When to create sidecars for existing notes that lack one**
   - What we know: Sidecars are required for metadata; missing sidecars must be rebuilt silently.
   - What's unclear: Whether rebuild happens on list, open, or save.
   - Recommendation: Rebuild on list (background) to ensure overview is complete and consistent.

2. **When to resync sidecars after external edits**
   - What we know: Title is derived from first line and should reflect the file.
   - What's unclear: Trigger point for resync (on list vs. on open).
   - Recommendation: Resync on list for title/updated_at, but avoid rewriting if no change.

3. **Orphan sidecar cleanup grace period**
   - What we know: Cleanup is manual only, with a summary.
   - What's unclear: Whether to keep a grace period before removal.
   - Recommendation: No grace period by default; add optional "last seen" in report if needed later.

## Sources

### Primary (HIGH confidence)
- https://docs.rs/tauri/latest/tauri/attr.command.html - Tauri command attribute
- https://docs.rs/serde_json/latest/serde_json/ - JSON serialization/deserialization patterns
- https://doc.rust-lang.org/std/fs/index.html - Filesystem APIs + TOCTOU guidance
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat - Locale-aware time formatting

### Secondary (MEDIUM confidence)
- Repo manifests: `app/package.json`, `app/src-tauri/Cargo.toml` (stack versions in use)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived from repo manifests and official docs.
- Architecture: HIGH - matches existing command/service/domain pattern in repo.
- Pitfalls: MEDIUM - TOCTOU is documented; others are domain-specific but consistent with decisions.

**Research date:** 2026-01-30
**Valid until:** 2026-03-01
