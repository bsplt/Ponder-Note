# STATE: Ponder

## Project Reference

**Core value:** Capture meeting notes and reliably surface all open to-dos (and complete them in-place) without leaving Ponder.

**Constraints:** macOS-only; Tauri (Rust) + Web UI; local-first workspace folder; notes are `*.md` in workspace root; rebuildable app data under `<workspace>/.ponder/`; soft delete to `<workspace>/deleted/`.

## Current Position

**Current phase:** 5 of 7 - Todos (Extract, Browse, Toggle)

**Plan:** 06 of 06

**Status:** Phase complete

**Last activity:** 2026-02-02 - Completed 05-06-PLAN.md

**Progress:** [████████████████████████████]

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

**Open questions (defer until needed):**
- Exact rebuild semantics for sidecars (what is regenerated vs preserved) when `.ponder/` is wiped.

## Session Continuity

**Next action:** Ready for Phase 6 - Soft Delete

**Last session:** 2026-02-02T20:12:50Z
**Stopped at:** Completed 05-06-PLAN.md (Phase 5 complete)
**Resume file:** None
