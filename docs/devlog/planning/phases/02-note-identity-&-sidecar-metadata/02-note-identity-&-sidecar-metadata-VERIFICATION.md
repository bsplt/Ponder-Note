---
phase: 02-note-identity-&-sidecar-metadata
verified: 2026-01-31T09:44:33Z
status: human_needed
score: 8/8 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "Each note has a sidecar JSON with title and created_at matching the filename"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "New Note filesystem effects"
    expected: "A new <unix_ms>.md appears in workspace root and .ponder/meta/<stem>.json is created."
    why_human: "Requires filesystem observation and live app run."
  - test: "Timestamp formatting behavior"
    expected: "Today shows HH:mm and older shows dd.MM.yyyy in de-DE format."
    why_human: "Visual locale formatting is runtime/UI dependent."
---

# Phase 02: Note Identity & Sidecar Metadata Verification Report

**Phase Goal:** Notes have stable identity, titles, timestamps, and rebuildable per-note metadata.
**Verified:** 2026-01-31T09:44:33Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Title derivation normalizes first-line markdown into a display title | ✓ VERIFIED | `app/src-tauri/src/domain/note_title.rs` implements ordered normalization with tests. |
| 2 | Empty or marker-only first lines yield the title "Untitled" | ✓ VERIFIED | `derive_note_title` returns "Untitled" on empty/"---"/marker-only inputs. |
| 3 | Listing notes derives entries from workspace-root `.md` files only (orphan sidecars ignored) | ✓ VERIFIED | `list_notes` iterates root files only and ignores sidecars without `.md` (`app/src-tauri/src/services/workspace_service.rs`). |
| 4 | Each note has a sidecar JSON with `title` and `created_at` matching the filename | ✓ VERIFIED | `NoteSidecar` serializes snake_case and aliases camelCase for legacy (`app/src-tauri/src/domain/note.rs`). |
| 5 | Creating a note writes `<unix_ms>.md` and its sidecar in `.ponder/meta` | ✓ VERIFIED | `create_note` writes `<timestamp>.md` and `.ponder/meta/<timestamp>.json`. |
| 6 | Overview renders note titles derived from first-line content | ✓ VERIFIED | `Overview` renders `note.title` (from sidecar, updated via `derive_note_title`). |
| 7 | Overview shows de-DE timestamps (time for today, date for older notes) | ✓ VERIFIED | `formatNoteTimestamp` uses `Intl.DateTimeFormat('de-DE', ...)` with today vs older logic. |
| 8 | New Note action creates a note and refreshes the list | ✓ VERIFIED | `workspaceActions.createNote()` calls backend, then `refreshNotes` in `workspaceStore`. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/src-tauri/src/domain/note_title.rs` | Title derivation helper + tests | ✓ VERIFIED | Substantive implementation with unit tests calling `derive_note_title`. |
| `app/src-tauri/src/domain/mod.rs` | Exports note_title module | ✓ VERIFIED | `pub mod note_title;` present. |
| `app/src-tauri/src/domain/note.rs` | NoteSidecar + NoteSummary structs | ✓ VERIFIED | NoteSidecar serializes snake_case with legacy aliases and tests. |
| `app/src-tauri/src/services/workspace_service.rs` | list_notes/create_note with sidecars | ✓ VERIFIED | Root `.md` scan, sidecar rebuild/write, create note. |
| `app/src-tauri/src/commands/workspace.rs` | Commands for list/create | ✓ VERIFIED | `workspace_list_notes` and `workspace_create_note` call service methods. |
| `app/src/api/workspace.ts` | NoteSummary type + list/create APIs | ✓ VERIFIED | `workspaceListNotes`/`workspaceCreateNote` invoke commands. |
| `app/src/stores/workspaceStore.ts` | notes state + createNote action | ✓ VERIFIED | `notes` state, `refreshNotes`, `createNote` wired to API. |
| `app/src/screens/Overview.tsx` | UI rows + New Note | ✓ VERIFIED | Renders title + timestamp; New Note button triggers create. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `app/src-tauri/src/domain/note_title.rs` | `app/src-tauri/src/domain/note_title.rs` | `#[test]` cases | ✓ WIRED | Tests call `derive_note_title`. |
| `app/src-tauri/src/services/workspace_service.rs` | `app/src-tauri/src/domain/note_title.rs` | `derive_note_title` | ✓ WIRED | Imported and called when listing notes. |
| `app/src-tauri/src/services/workspace_service.rs` | `app/src-tauri/src/domain/note.rs` | `NoteSidecar` serialization | ✓ WIRED | `write_sidecar` uses `NoteSidecar` with snake_case serialization. |
| `app/src-tauri/src/commands/workspace.rs` | `app/src-tauri/src/services/workspace_service.rs` | `list_notes/create_note` | ✓ WIRED | Commands call service methods. |
| `app/src/screens/Overview.tsx` | `app/src/stores/workspaceStore.ts` | `workspaceActions.createNote` | ✓ WIRED | New Note button triggers createNote. |
| `app/src/stores/workspaceStore.ts` | `app/src/api/workspace.ts` | `workspaceListNotes/workspaceCreateNote` | ✓ WIRED | Store uses API wrappers. |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
| --- | --- | --- |
| N/A (REQUIREMENTS.md not found) | ? NEEDS HUMAN | — |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | — | — | — | No anti-patterns detected in scanned files. |

### Human Verification Required

1. **New Note filesystem effects**
**Test:** Click "New Note" in overview.
**Expected:** A new `<unix_ms>.md` appears in workspace root and `.ponder/meta/<stem>.json` is created.
**Why human:** Requires filesystem observation and live app run.

2. **Timestamp formatting behavior**
**Test:** Inspect overview timestamps for a note created today vs an older note.
**Expected:** Today shows `HH:mm` and older shows `dd.MM.yyyy` in de-DE format.
**Why human:** Visual locale formatting is runtime/UI dependent.

### Gaps Summary

All must-have code artifacts and wiring are present; remaining verification requires human checks for filesystem effects and locale formatting in the running app.

---

_Verified: 2026-01-31T09:44:33Z_
_Verifier: Claude (gsd-verifier)_
