# STATE: Ponder

## Project Reference

**Core value:** Capture meeting notes and reliably surface all open to-dos (and complete them in-place) without leaving Ponder.

**Constraints:** macOS-only; Tauri (Rust) + Web UI; local-first workspace folder; notes are `*.md` in workspace root; rebuildable app data under `<workspace>/.ponder/`; soft delete to `<workspace>/deleted/`.

## Current Position

**Current phase:** 4 of 7 - Search & Tags

**Plan:** 05 of 05

**Status:** Phase complete

**Last activity:** 2026-02-02 - Completed 04-05-PLAN.md (Phase 4 complete)

**Progress:** [█████████████████████████]

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

**Open questions (defer until needed):**
- Exact rebuild semantics for sidecars (what is regenerated vs preserved) when `.ponder/` is wiped.
- Markdown todo parsing/toggle strategy to minimize corrupt writes in edge cases.

## Session Continuity

**Next action:** Begin Phase 5 - Todos (Extract, Browse, Toggle)

**Last session:** 2026-02-02T07:16:07Z
**Stopped at:** Completed Phase 4 (04-05-PLAN.md)
**Resume file:** None
