# Ponder

## What This Is

Ponder is a macOS note-taking app for work meeting protocols stored as plain markdown files in a folder (“workspace”). It lets you browse, search, and act on notes and their extracted to-dos without leaving the app via a fast overview, a simple editor, and a dedicated todo list view.

## Core Value

I can capture meeting notes and reliably surface all open to-dos (and complete them in-place) without leaving Ponder.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Workspace-backed notes: read/write `.md` files in the workspace root; filename is UNIX timestamp in milliseconds
- [ ] Overview screen: list notes with previews (title from first line, timestamp, tags), deep search across note contents, filter by tags, mouse + keyboard navigation, first list item is `+ New Note`
- [ ] Editor screen: plain markdown editing, autosave, show created timestamp, dedicated tags field (CSV) with autocomplete from existing tags, exit via `ESC` back to overview
- [ ] Todo extraction: detect markdown todos (`[ ]` / `- [ ]`), group todos by note tags, order by tag then recency (updated_at), and support `o ` -> `[ ] ` conversion on leaving a note
- [ ] Todo list screen: open via `T` from overview; clicking a todo toggles checked/unchecked in the source note; toggled items remain visible until leaving the screen, but reflect their checked state
- [ ] Soft delete: from overview press `d` on focused note, confirm with `d` again; move note into `deleted/` and hide from app
- [ ] Workspace switching: in overview press `1`-`9` to switch workspaces; if a slot has no folder yet, prompt with folder picker; reopen last active slot on launch

### Out of Scope

- Markdown preview rendering in v1 — editor is edit-only
- Cloud sync / accounts / collaboration — local files only
- iOS / mobile app — macOS only
- Recursive folder scanning — workspace root only
- Hard delete — notes are moved to `deleted/`

## Context

- Current frustration: notes are a loose folder of files and require system navigation to open; to-dos are not a single source of truth.
- Target user: primarily me, for work note-taking.
- Success signal: after one week of v1, I exclusively use Ponder for taking work notes and managing my meeting todos.
- Design input: Figma layouts/components will be provided via the local MCP; implementation should match closely.

## Constraints

- **Platform**: macOS
- **App stack**: Tauri (Rust) + Web UI; styles should be easy to modify (CSS-first)
- **Dev environment**: use the repo's Nyx flake / shell for building and running
- **Workspace structure**:
  - Notes: `<workspace>/*.md` (root only)
  - Rebuildable app data: `<workspace>/.ponder/`
  - Per-note sidecars: `<workspace>/.ponder/meta/<stem>.json`
  - Soft deletes: `<workspace>/deleted/`
- **Source of truth**:
  - Title: first line of markdown; if it starts with `#` strip it for display
  - created_at: equals filename timestamp (stem)
  - Tags: stored in sidecar JSON (required: `title`, `created_at`; optional: `updated_at`, `tags`)
- **Workspace slots config**: global per-user config file at PlatformDirs(appname="Ponder").user_config_path `config.json`:
  - `{ "workspaces": ["/path", null, ...], "active_slot": 3 }`
- **Keyboard-first navigation**: `ESC` (editor -> overview), `T` (overview -> todo list), `1-9` (workspace switch), `d` then `d` (delete confirm)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| macOS-only v1 | Focus and ship quickly | — Pending |
| Tauri + Rust + Web UI | CSS-first styling, modular UI | — Pending |
| Notes as markdown files in workspace root | User-owned data, easy backup | — Pending |
| Filename = UNIX ms timestamp | Stable created_at and unique IDs | — Pending |
| Tags stored in sidecar JSON under `.ponder/meta/` | Rebuildable metadata and fast tag autocomplete | — Pending |
| Full-text search filters list (titles only shown) | Find info quickly without leaving overview | — Pending |
| Todo source-of-truth is the note text; todo view toggles in-place | Single source of truth for todos | — Pending |

---
*Last updated: 2026-01-30 after initialization*
