# Phase 7: Rebuildability & UI Fidelity - Research

**Researched:** 2026-02-03
**Domain:** Tauri (Rust) + React (CSS-first theming) + rebuildable local workspace state
**Confidence:** MEDIUM

## Summary

This phase focuses on two intersecting concerns: (1) centralizing and tokenizing UI styles so the app matches Figma and can be themed via CSS variables, and (2) making derived workspace state fully rebuildable when `.ponder/` is deleted, without modifying Markdown note contents. The current stack is React 19 + Vite 7 on the frontend with a Rust/Tauri 2 backend; styling is already CSS-first in `app/src/styles.css`, so the standard approach is to expand that file into a full token system that covers all screens and components.

The rebuild requirement is best satisfied by an explicit, idempotent Rust routine that (a) ensures `.ponder/meta/` exists, (b) scans root `*.md` files, (c) (re)creates or repairs sidecars, and (d) recreates any derived index artifacts under `.ponder/` while leaving Markdown untouched. The rebuild should run on app launch and workspace switch, and write a structured summary log under `.ponder/` for the “View rebuild log” action. Keep the rebuild silent in UX, and only surface the log when the user requests it.

**Primary recommendation:** Centralize theme tokens in `app/src/styles.css` using CSS custom properties and implement a Rust rebuild routine that recreates `.ponder` derived state with a structured log, triggered on boot and workspace switch.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | UI rendering | Current project runtime for screens/components |
| Vite | 7.0.4 | Frontend build/dev | Existing build system |
| TypeScript | 5.8.3 | UI types | Existing project language |
| Tauri | 2.x | Desktop shell + Rust bridge | Existing app shell + command system |
| CSS Custom Properties | n/a (web standard) | Theme tokens | CSS-first theming via `var()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | 2.x | JS↔Rust bridge | UI invokes rebuild/log commands |
| tauri-plugin-dialog | 2.6.0 | Native dialogs | If log view needs open/save dialogs |
| tauri-plugin-opener | 2.x | Open files/links | Optional “View rebuild log” open in OS |
| serde / serde_json | 1.x | JSON IO | Sidecars + rebuild log serialization |
| tempfile | 3.x | Atomic writes | Safe log/sidecar writes via temp files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS custom properties | CSS-in-JS (styled-components/emotion) | Adds runtime dependency, conflicts with CSS-first requirement |
| CSS `clamp()` for fluid type | JS resize handlers | More complex and less reliable than CSS-native behavior |
| `.ponder` JSON log | Plain-text log | Harder to parse for UI summary + future automation |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
app/src/
├── styles.css          # Global tokens + shared component styles
├── screens/            # Overview, Editor, Todo List, Workspaces
├── components/         # SearchBar, PillInput, TagAutocomplete, Toast
├── stores/             # workspaceStore (refresh after rebuild)
└── api/                # workspace commands (add rebuild/log endpoints)

app/src-tauri/src/
├── commands/           # workspace_rebuild, workspace_get_rebuild_log
├── services/           # WorkspaceService rebuild logic
└── domain/             # Note/sidecar schemas, rebuild log struct
```

### Pattern 1: Centralized Theme Tokens via CSS Custom Properties
**What:** Define all colors/typography/spacing/radii/shadows in `:root` and reference them via `var()` in component styles.
**When to use:** Always for CSS-first theming and Figma fidelity.
**Example:**
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/--* */
:root {
  --color-bg: #0c0f14;
  --color-text: rgba(255, 255, 255, 0.92);
  --radius-md: 12px;
  --space-3: 12px;
}

.btn {
  background: var(--color-bg);
  color: var(--color-text);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
```

### Pattern 2: Readable Editor Column with `clamp()` + `ch`
**What:** Use `max-width` in `ch` for line length and `clamp()` for fluid base font size.
**When to use:** Editor/reader content columns and long-form text.
**Example:**
```css
/* Sources: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp
   https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/max-width
   https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#ch */
.editorContent {
  max-width: 72ch;
  width: min(100%, 72ch);
  margin: 0 auto;
  padding: clamp(12px, 2vw, 24px);
  font-size: clamp(14px, 0.9rem + 0.4vw, 18px);
  line-height: 1.6;
}
```

### Pattern 3: Idempotent Rebuild of Derived State
**What:** Ensure `.ponder/` exists, scan root `*.md`, rebuild sidecars, then write a rebuild summary log.
**When to use:** App launch and workspace switch; silent background repair.
**Example:**
```rust
// Sources: https://doc.rust-lang.org/std/fs/fn.create_dir_all.html
//          https://doc.rust-lang.org/std/fs/fn.read_dir.html
use std::fs;

fn rebuild_workspace(root: &std::path::Path) -> std::io::Result<()> {
    let meta_dir = root.join(".ponder").join("meta");
    fs::create_dir_all(&meta_dir)?;

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        // read note, derive title, write sidecar under .ponder/meta/
    }

    Ok(())
}
```

### Anti-Patterns to Avoid
- **Hardcoded per-component colors:** breaks centralized theming; use tokens.
- **JS-driven resize logic for font sizing:** conflicts with CSS-first and adds jitter.
- **Rebuild edits Markdown:** violates SAFE-03; rebuild must only touch `.ponder/`.
- **Assuming `read_dir` order is stable:** sort if ordering matters.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theming system | Per-component hardcoded styles | CSS custom properties (`var()`) | Centralized, cascade-aware theming |
| Fluid typography | JS resize handlers | CSS `clamp()` | Native, reliable, simpler |
| Max line length | Manual character counting | `max-width: 72ch` | Built-in sizing based on font metrics |
| Atomic writes | Manual temp-file logic | `tempfile::NamedTempFile` | Safe persistence + fewer edge cases |

**Key insight:** Let CSS and Rust stdlib handle resizing and filesystem safety; custom solutions add brittleness and testing overhead.

## Common Pitfalls

### Pitfall 1: Editing Markdown during rebuild
**What goes wrong:** Rebuild changes note contents, violating SAFE-03 and user trust.
**Why it happens:** Rebuild logic reused from save paths that rewrite text.
**How to avoid:** Rebuild only reads Markdown and writes `.ponder/*` artifacts.
**Warning signs:** Notes show modified timestamps after rebuild.

### Pitfall 2: Using the wrong stylesheet entry
**What goes wrong:** Changes land in unused CSS, so UI doesn’t update.
**Why it happens:** Legacy `App.css` exists but the app imports `styles.css`.
**How to avoid:** Centralize theme tokens in `app/src/styles.css` (imported by `App.tsx`).
**Warning signs:** Styles appear only in dev tools but not in UI.

### Pitfall 3: Unstable rebuild ordering
**What goes wrong:** UI ordering changes between runs, causing flaky tests and confusion.
**Why it happens:** `read_dir` order is not guaranteed.
**How to avoid:** Collect, sort, then process entries when order matters.
**Warning signs:** Notes appear in different order after rebuild.

### Pitfall 4: Losing extra sidecar fields
**What goes wrong:** Rebuild overwrites sidecars and drops unknown fields.
**Why it happens:** Sidecar structs are serialized without preserving extra fields.
**How to avoid:** Preserve unknown JSON keys when rebuilding sidecars.
**Warning signs:** User tags or metadata disappear after rebuild.

## Code Examples

Verified patterns from official sources:

### Fluid Typography With Clamp
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp */
.editorText {
  font-size: clamp(14px, 0.9rem + 0.4vw, 18px);
}
```

### Readable Column Width With `max-width` and `ch`
```css
/* Sources: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/max-width
   https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#ch */
.editorColumn {
  max-width: 72ch;
  width: min(100%, 72ch);
  margin: 0 auto;
}
```

### Atomic Write With NamedTempFile
```rust
// Source: https://docs.rs/tempfile/latest/tempfile/struct.NamedTempFile.html
use std::io::Write;
use tempfile::NamedTempFile;

fn atomic_write(path: &std::path::Path, payload: &str) -> std::io::Result<()> {
    let mut tmp = NamedTempFile::new_in(path.parent().unwrap())?;
    tmp.write_all(payload.as_bytes())?;
    tmp.persist(path)?;
    Ok(())
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed font size + fixed width | `clamp()` + `max-width` in `ch` | ~2020 (clamp support) | Readable editor at all window sizes |
| Per-component hardcoded colors | Tokenized CSS custom properties | 2017+ (CSS variables) | Centralized theming + Figma fidelity |
| Ad-hoc derived state handling | Explicit rebuild routine + log | Project requirement | Safe recovery when `.ponder/` is deleted |

**Deprecated/outdated:**
- `app/src/App.css`: legacy template styles; not imported by the app.

## Open Questions

1. **What is the exact `.ponder/index` shape for this phase?**
   - What we know: requirements mention an index under `.ponder/`, but current code only uses sidecars.
   - What's unclear: whether to introduce a minimal index manifest now or defer until full search indexing.
   - Recommendation: create a minimal rebuild log + placeholder index manifest, and keep future index schema versioned.

2. **How should “View rebuild log” be presented?**
   - What we know: action is required and should show last run summary.
   - What's unclear: in-app modal vs opening a file via OS.
   - Recommendation: use an in-app modal with a “Open log file” button (via `tauri-plugin-opener`).

## Sources

### Primary (HIGH confidence)
- https://developer.mozilla.org/en-US/docs/Web/CSS/--* - CSS custom properties and `var()` usage
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp - Fluid sizing with `clamp()`
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/max-width - Max width constraints
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#ch - `ch` unit semantics
- https://doc.rust-lang.org/std/fs/fn.create_dir_all.html - Ensure `.ponder/` paths exist
- https://doc.rust-lang.org/std/fs/fn.read_dir.html - Directory scanning and ordering caveats
- https://docs.rs/tempfile/latest/tempfile/struct.NamedTempFile.html - Atomic temp file persistence

### Secondary (MEDIUM confidence)
- `docs/devlog/planning/research/ARCHITECTURE.md` - Project guidance on rebuildable derived state and `.ponder/index`
- `app/package.json` + `app/src-tauri/Cargo.toml` - Stack versions in use

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions from `app/package.json` and `app/src-tauri/Cargo.toml`
- Architecture: MEDIUM - index details not implemented yet, relies on internal guidance
- Pitfalls: MEDIUM - based on current code + platform behavior docs

**Research date:** 2026-02-03
**Valid until:** 2026-03-05
