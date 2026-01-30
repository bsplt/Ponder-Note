# Stack Research

**Domain:** macOS-only note-taking app (Tauri + Rust backend + Web UI) storing local Markdown files with sidecar metadata + full-text search + todo extraction
**Researched:** 2026-01-30
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.9.x | Desktop shell (WKWebView on macOS) + secure IPC | Current mainstream Tauri major; v2 has capabilities/permissions model and first-party plugins; keeps app size small by using the system webview. |
| Rust | >= 1.77.2 | Backend + filesystem/indexing + native integrations | Current Tauri v2 plugins require Rust >= 1.77.2; Rust is the right place for trusted file IO + indexing in a desktop app. |
| React | 19.x | UI framework inside the webview | React 19 is the current mainstream release line; strong ecosystem for editor components, keyboard interactions, and state management. |
| TypeScript | 5.9.x | Type-safe UI code | Current TS release line; good ergonomics for Tauri IPC contracts and UI state. |
| Vite | 7.3.x | Frontend dev server + build | Vite is the de facto standard with Tauri (fast HMR, simple config, broad plugin ecosystem). |
| SQLite (FTS5) | SQLite 3 + FTS5 | Local search/index DB (FTS + derived data) | SQLite FTS5 is a proven embedded full-text search option; great fit for local notes, incremental updates, and “single file” durability. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CodeMirror | 6.x (packages) | Markdown editor component | Use for the v1 “plain markdown edit-only” editor: good keyboard accessibility, extensible keymaps, and performant large-doc handling. |
| rusqlite | 0.38.x | Embedded SQLite access from Rust | Use when you want the index DB to be Rust-owned (recommended for this app). |
| notify | 8.2.x | Filesystem watching for incremental indexing | Use to watch the workspace root + `.ponder/meta/` and schedule reindex work on changes. |
| serde / serde_json | 1.x | JSON IO (sidecar metadata + global config) | Use for `<workspace>/.ponder/meta/<stem>.json` and per-user `config.json`. |
| tokio | 1.x | Background tasks + async file IO | Use for indexing workers, debounced update pipelines, and non-blocking file IO. |
| tauri-plugin-dialog | 2.6.x | Native folder picker (workspace select) | Use for selecting/adding a workspace path without broad filesystem permissions in the renderer. |
| tauri-plugin-store | 2.4.x | Optional persisted settings store | Use only if you want a key/value store instead of your explicit `config.json` format. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tauri-apps/tauri-action | CI builds + packaging | Standard GitHub Actions approach for building and releasing Tauri apps. |
| Vitest | Unit tests for UI | Vite-native; keep most UI behavior (keyboard nav, list filtering, rendering) testable without a running Tauri bundle. |
| Playwright | Browser-level e2e for the Web UI | Use against the web build (or Vite dev server) for end-to-end flows; Tauri’s WebDriver story does not cover macOS. |

## Installation

```bash
# Core (frontend)
npm install react react-dom

# Editor (pick a CodeMirror 6 bundle style)
npm install @codemirror/view @codemirror/state @codemirror/commands @codemirror/search @codemirror/autocomplete @codemirror/lang-markdown

# Tauri plugins used by the renderer (optional; you can call dialogs from Rust too)
npm install @tauri-apps/plugin-dialog

# Dev dependencies
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/user-event playwright

# Core (rust)
cargo add tauri@2.9.5
cargo add rusqlite@0.38.0 notify@8.2.0 serde@1 serde_json@1 tokio@1

# Tauri plugins (rust)
cargo add tauri-plugin-dialog@2.6.0
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SQLite FTS5 index (Rust-owned) | Tantivy (Rust search engine) | Consider if you need advanced ranking, very large corpora, or custom analyzers beyond what SQLite tokenizers provide. |
| Rust-owned DB access (rusqlite) | tauri-plugin-sql (sqlx bridge to frontend) | Only if you explicitly want the renderer to execute SQL (generally not needed for this app and expands the permission surface). |
| CodeMirror 6 | Monaco Editor | Use Monaco only if you need VS Code-like editing features; it’s heavier and tends to dominate bundle size/runtime. |
| UI tests via Vitest + Playwright | Tauri WebDriver (`tauri-driver`) | Tauri WebDriver support is not available on macOS due to missing WKWebView driver tooling. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Electron (for this project) | Larger runtime footprint; unnecessary if you’re already on Tauri and macOS-only. | Tauri 2.x |
| Renderer-driven filesystem access for the workspace | Forces broad permissions/capabilities, increases attack surface, and duplicates IO logic across JS+Rust. | Keep workspace IO in Rust commands; use dialog plugin for picking the workspace folder. |
| External/sidecar search servers (Meilisearch/etc.) | Adds another process, complicates distribution, and is overkill for local markdown notes. | SQLite FTS5 index inside `.ponder/index.sqlite` |
| Regex-only “todo toggling” without safeguards | Easy to corrupt user content (false matches, formatting edge cases). | Use a constrained checkbox-line matcher + round-trip tests; optionally parse Markdown to locate task lines. |

## Stack Patterns by Variant

**If you want the safest/cleanest security posture (recommended):**
- Use Rust commands for all note IO (read/write/move/delete) and indexing.
- Because Tauri v2’s capability model becomes simpler when the renderer doesn’t need broad FS permissions.

**If you want rapid prototyping with more renderer autonomy:**
- Use `tauri-plugin-fs` 2.4.x for limited, scoped file reads/writes.
- Because it can speed up iteration, but you must carefully scope capabilities and accept the larger permission surface.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| tauri@2.9.5 | Rust >= 1.77.2 | First-party plugins list Rust >= 1.77.2 as a requirement; align MSRV to that baseline. |
| tauri-plugin-dialog@2.6.0 | tauri@2.9.x | Dialog plugin depends on `tauri ^2.9.3` per docs.rs; keep plugin + tauri versions aligned. |
| notify@8.2.0 | macOS FSEvents backend | Handles editor “atomic save” behaviors; still needs debouncing and robust event normalization. |

## Notes Specific to This Project

- **Workspace model:** notes live in workspace root only; keep the watcher non-recursive and treat subfolders (`deleted/`, `.ponder/`) as special-cased paths.
- **Index storage:** keep `.ponder/index.sqlite` for derived data (FTS index, todo extraction cache, per-note hashes/mtimes) while treating `*.md` + `.ponder/meta/*.json` as the source of truth.
- **Incremental indexing loop:** on file events, debounce then re-read the impacted file(s), update `notes` + `notes_fts`, and re-extract todos; prefer a single-writer background worker to avoid DB contention.

### Search + Indexing (Prescriptive)

- **Use SQLite FTS5** in `.ponder/index.sqlite`.
- **Watcher:** use `notify` in Rust to watch:
  - `<workspace>/` for `*.md` create/write/rename/remove
  - `<workspace>/.ponder/meta/` for `<stem>.json` updates
- **Debounce:** assume “atomic saves” (write temp + rename) and coalesce events per path (notify docs explicitly warn editor behaviors vary).
- **Schema sketch (minimum):**
  - `notes(id TEXT PRIMARY KEY, path TEXT, created_at INTEGER, updated_at INTEGER, title TEXT, tags_json TEXT, mtime INTEGER, content_hash TEXT)`
  - `notes_fts` as `CREATE VIRTUAL TABLE notes_fts USING fts5(id UNINDEXED, title, body, tokenize='unicode61');`
  - `todos(id INTEGER PRIMARY KEY, note_id TEXT, line_no INTEGER, text TEXT, checked INTEGER, extracted_at INTEGER)`
- **Update strategy:** no triggers; update both `notes` and `notes_fts` from the same Rust code path to avoid “FTS external content table pitfalls”.
- **Search query strategy:**
  - Title/body search: `notes_fts MATCH ?` and sort via `bm25()` or `rank`.
  - Tag filtering: keep a `note_tags(note_id TEXT, tag TEXT)` table if tag filters need to be fast/clean; otherwise store `tags_json` and filter in Rust for v1.

### Storage Layout (Prescriptive)

- **Canonical user data:**
  - `<workspace>/<stem>.md`
  - `<workspace>/.ponder/meta/<stem>.json`
- **Derived/cached data:**
  - `<workspace>/.ponder/index.sqlite`
- **Deletes:** move to `<workspace>/deleted/<stem>.md` and also move/keep meta as desired; ensure the indexer treats `deleted/` as out-of-scope.
- **Per-user config:** store `config.json` (workspace slots + last active) under the OS app config directory (do not put it inside a workspace).

### Testing + Packaging + CI (Prescriptive)

- **Unit tests:**
  - Rust: `cargo test` for indexing, todo extraction/toggling, and meta validation.
  - UI: Vitest + Testing Library for keyboard nav, search/filter logic, and editor integration.
- **E2E:** use Playwright against the web build/dev server; Tauri’s WebDriver approach explicitly does not support macOS.
- **CI:**
  - PR: lint + `cargo test` + `vitest`.
  - Release: `tauri-apps/tauri-action` builds macOS targets and publishes artifacts.
- **macOS distribution:** DMG via Tauri bundler; add signing/notarization in CI when you start distributing outside local dev.

## Sources

- https://tauri.app/ — Tauri 2.0 docs and project overview (HIGH)
- https://docs.rs/tauri/2.9.5/tauri/ — Tauri crate version and features (HIGH)
- https://github.com/tauri-apps/tauri/releases — Tauri v2.9.x releases (HIGH)
- https://tauri.app/plugin/dialog/ and https://docs.rs/tauri-plugin-dialog/2.6.0/tauri_plugin_dialog/ — dialog plugin + version (HIGH)
- https://tauri.app/plugin/store/ and https://docs.rs/tauri-plugin-store/2.4.2/tauri_plugin_store/ — store plugin + version (HIGH)
- https://tauri.app/plugin/sql/ and https://docs.rs/tauri-plugin-sql/2.3.1/tauri_plugin_sql/ — SQL plugin + version (HIGH)
- https://tauri.app/distribute/pipelines/github/ and https://github.com/tauri-apps/tauri-action — CI/release workflow guidance (HIGH)
- https://tauri.app/develop/tests/webdriver/ — Tauri WebDriver support note (macOS unsupported) (HIGH)
- https://vite.dev/ — Vite current version line shown on site (HIGH)
- https://github.com/facebook/react/releases — React 19.x releases (HIGH)
- https://github.com/microsoft/TypeScript/releases — TypeScript 5.9.x releases (HIGH)
- https://www.sqlite.org/fts5.html — FTS5 reference (HIGH)
- https://docs.rs/rusqlite/0.38.0/rusqlite/ — rusqlite version (HIGH)
- https://docs.rs/notify/8.2.0/notify/ — notify version + known issues (HIGH)
- https://codemirror.net/6/ — CodeMirror 6 overview (MEDIUM; page does not pin npm package versions)
- https://vitest.dev/ — Vitest current version line shown on site (HIGH)
- https://playwright.dev/ — Playwright overview (MEDIUM; landing page doesn’t pin versions)

---
*Stack research for: macOS Markdown notes app (Tauri + Rust + Web UI)*
*Researched: 2026-01-30*
