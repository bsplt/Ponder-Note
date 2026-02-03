# STATE: Ponder

## Project Reference

**Core value:** Capture meeting notes and reliably surface all open to-dos (and complete them in-place) without leaving Ponder.

**Constraints:** macOS-only; Tauri (Rust) + Web UI; local-first workspace folder; notes are `*.md` in workspace root; rebuildable app data under `<workspace>/.ponder/`; soft delete to `<workspace>/deleted/`.

## Current Position

**Current phase:** 6 of 7 - Soft Delete

**Plan:** 1 of 2 in current phase

**Status:** In progress

**Last activity:** 2026-02-03 - Completed 06-01-PLAN.md

**Progress:** [█████████████████████████████░░]

## Performance Metrics (v1)

- Trust: no data loss; no corrupted Markdown after autosave/toggles
- Speed: overview search/filter feels instant for typical vault sizes
- Habit: after 1 week, user primarily uses Ponder for meeting notes + todo follow-up

## Accumulated Context

**Key decisions (locked):**
- Notes are plain Markdown files in workspace root; filename is UNIX ms timestamp.
- Title is derived from first line (strip leading `#` for display).
- Tags live in sidecar JSON under `.ponder/meta/`.
- Todo list toggles checkboxes by editing the source Markdown.
- Exit checklist rewrite treats leading tabs as non-indentation for matching.
- Exit confirmation is allowed if the final save fails.
- Title-only search for Phase 4 (body search deferred until NoteSummary includes body field).
- Search state lives in App component for persistence across navigation (Overview ↔ Editor).
- Tag editor uses blur-based autosave (not debounced) to batch tag changes before backend write.
- Workspace store refresh pattern preferred over custom events for reactive UI updates.
- Todos from multi-tag notes appear in ALL matching tag groups (cross-group appearance).
- Groups ordered by most recent activity; within groups, todos ordered by note recency then title.
- Use regex for GFM checkbox parsing (simpler than full markdown parser).
- LazyLock for expensive regex compilation (compile once at startup).
- list_todos filters to open todos only (checked=false) by default.
- toggle_todo uses atomic_write_note for safe concurrent file modification.
- DTO pattern with camelCase serialization for frontend compatibility.
- T key from Overview opens TodoList (not from Editor - keeps Editor focused).
- Optimistic updates apply to ALL instances across groups (cross-group sync).
- Arrow keys navigate flattened list; groups are for display only.
- Auto-refresh on toggle error to restore correct state.
- Soft delete moves note to deleted/ via fs::rename; sidecar stays orphaned in .ponder/meta/; list_notes naturally ignores it.
- Conflict handling in deleted/ uses numeric suffix _1, _2, etc.

**Open questions (defer until needed):**
- Exact rebuild semantics for sidecars (what is regenerated vs preserved) when `.ponder/` is wiped.

## Session Continuity

**Next action:** Execute 06-02-PLAN.md (frontend delete confirmation UX)

**Last session:** 2026-02-03T06:29:01Z
**Stopped at:** Completed 06-01-PLAN.md (backend delete command)
**Resume file:** None
