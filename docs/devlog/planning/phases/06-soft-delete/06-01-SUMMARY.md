---
phase: 06-soft-delete
plan: 01
subsystem: api
tags: [rust, tauri, soft-delete, file-move]

requires:
  - phase: 03-overview-editor-loop
    provides: atomic_write_note, WorkspaceService pattern, note_path_from_stem
  - phase: 05-todos
    provides: WorkspaceServiceError enum (NoteNotFound variant already present)
provides:
  - note_delete Tauri command callable from frontend
  - WorkspaceService::note_delete method with atomic file move to deleted/
  - Numeric-suffix conflict resolution in deleted/ folder
affects:
  - 06-02 (frontend delete confirmation UX will invoke this command)
  - 07-rebuildability (deleted/ folder is an established workspace artifact)

tech-stack:
  added: []
  patterns:
    - "Command handler pattern: lock Mutex<WorkspaceService>, call method, map error via map_error_code"
    - "Conflict resolution: while target_path.exists() { increment numeric suffix }"

key-files:
  created: []
  modified:
    - app/src-tauri/src/commands/notes.rs
    - app/src-tauri/src/lib.rs
    - app/src-tauri/src/services/workspace_service.rs

key-decisions:
  - "Sidecar metadata remains in .ponder/meta/ after delete (becomes orphaned); list_notes naturally ignores it"
  - "File move uses std::fs::rename (atomic on same filesystem); no fallback needed since deleted/ is in workspace root"
  - "Conflict suffix scheme: {stem}_1.md, {stem}_2.md — simple, scannable, matches CONTEXT.md spec"

patterns-established:
  - "note_delete follows same command/service split as note_read, note_save, note_discard"

duration: 2min
completed: 2026-02-03
---

# Phase 6 Plan 1: Backend Delete Command Summary

**note_delete Tauri command moves notes to deleted/ via atomic fs::rename with numeric-suffix conflict handling, leaving sidecars orphaned**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-03T06:27:04Z
- **Completed:** 2026-02-03T06:29:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `note_delete` Tauri command wired end-to-end: handler → service method → registered in invoke_handler
- Atomic file move via `std::fs::rename`; `deleted/` auto-created on first delete
- Numeric-suffix conflict resolution (`_1`, `_2`, …) prevents any overwrite in `deleted/`
- Sidecar left in `.ponder/meta/` (orphaned); confirmed `list_notes` naturally skips orphans
- 5 unit tests covering: basic move, dir creation, single/multi suffix conflicts, missing-note error

## Task Commits

Each task was committed atomically:

1. **Task 1: Add note_delete command handler** - `0993af9` (feat)
2. **Task 2: Implement note_delete with file move and conflict handling** - `2c471c1` (feat)

**Plan metadata:** *(pending)*

## Files Created/Modified
- `app/src-tauri/src/commands/notes.rs` - Added `note_delete` command handler
- `app/src-tauri/src/lib.rs` - Imported and registered `note_delete` in invoke_handler
- `app/src-tauri/src/services/workspace_service.rs` - Added `note_delete` method + 5 unit tests

## Decisions Made
- Sidecar metadata left in place intentionally — becomes orphaned. `list_notes` iterates workspace root `.md` files only, so orphan sidecars produce no ghost entries. Verified in code.
- Used `std::fs::rename` directly (not the `atomic_write_note` helper) because this is a move, not a write. Source and target are on the same filesystem (both under workspace root), so rename is atomic.
- Conflict suffix is `_{N}` starting at 1, matching the CONTEXT.md spec exactly.

## Deviations from Plan

### Auto-added Tests

**1. [Rule 2 - Missing Critical] Added 5 unit tests for note_delete logic**
- **Found during:** Task 2 verification
- **Issue:** Plan specified manual verification steps (create workspace, call command), but unit tests are more reliable and repeatable for CI
- **Fix:** Added unit tests using `tempfile::tempdir()` (same pattern as existing tests) covering all branches: basic move, dir auto-creation, single suffix, multi suffix, and missing-note error
- **Files modified:** `app/src-tauri/src/services/workspace_service.rs`
- **Verification:** All 36 tests pass (31 pre-existing + 5 new)
- **Committed in:** `2c471c1` (Task 2 commit)

---

**Total deviations:** 1 auto-added (missing critical — tests)
**Impact on plan:** Tests added for correctness assurance. No scope creep; all tests exercise exactly the specified behavior.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend delete command is complete and tested; ready for 06-02 (frontend delete confirmation UX)
- Frontend will call `note_delete` with the stem of the focused note after double-`d` confirmation
- No blockers

---
*Phase: 06-soft-delete*
*Completed: 2026-02-03*
