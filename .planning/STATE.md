# STATE: Ponder

## Project Reference

**Core value:** Capture meeting notes and reliably surface all open to-dos (and complete them in-place) without leaving Ponder.

**Constraints:** macOS-only; Tauri (Rust) + Web UI; local-first workspace folder; notes are `*.md` in workspace root; rebuildable app data under `<workspace>/.ponder/`; soft delete to `<workspace>/deleted/`.

## Current Position

**Current phase:** 2 - Note Identity & Sidecar Metadata

**Status:** In progress

**Last activity:** 2026-01-31 - Completed 02-note-identity-&-sidecar-metadata plan 02 (02-02-PLAN.md)

**Progress:** [█████████████████░░░] 86%

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

**Open questions (defer until needed):**
- Exact rebuild semantics for sidecars (what is regenerated vs preserved) when `.ponder/` is wiped.
- Markdown todo parsing/toggle strategy to minimize corrupt writes in edge cases.

## Session Continuity

**Next action:** Execute 02-03-PLAN.md

**Last session:** 2026-01-31T08:38:30Z
**Stopped at:** Completed 02-02-PLAN.md
**Resume file:** None
