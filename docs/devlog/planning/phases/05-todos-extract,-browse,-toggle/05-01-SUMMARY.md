---
phase: 05-todos-extract,-browse,-toggle
plan: 01
subsystem: domain
tags: [rust, regex, markdown, gfm, parsing, todos]

# Dependency graph
requires:
  - phase: 03-overview-editor-loop
    provides: note_rewrite.rs pattern for fence detection
provides:
  - TodoItem struct with location tracking (line_number, char_offset)
  - extract_todos function for parsing GFM checkboxes
  - Fence and blockquote skipping helpers
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: [regex]
  patterns: [LazyLock for regex optimization, helper function extraction]

key-files:
  created: [app/src-tauri/src/domain/todo.rs, app/src-tauri/src/domain/todo/tests.rs]
  modified: [app/src-tauri/Cargo.toml, app/src-tauri/src/domain/mod.rs]

key-decisions:
  - "Use regex for GFM checkbox parsing (simpler than full markdown parser)"
  - "Track char_offset for precise toggle operations"
  - "Follow note_rewrite.rs pattern for fence detection"
  - "Use LazyLock for one-time regex compilation"

patterns-established:
  - "LazyLock for expensive regex compilation"
  - "Helper functions is_fence_toggle and is_blockquote for reusability"

# Metrics
duration: 4h 10m
completed: 2026-02-02
---

# Phase 5 Plan 01: Todo Extraction Summary

**GFM checkbox extraction with precise location tracking using regex and lazy-compiled patterns following existing note_rewrite.rs conventions**

## Performance

- **Duration:** 4h 10m
- **Started:** 2026-02-02T12:50:02Z
- **Completed:** 2026-02-02T17:00:12Z
- **Tasks:** 3 (RED, GREEN, REFACTOR)
- **Files modified:** 4

## Accomplishments

- TodoItem struct includes text, checked, note_stem, line_number, and char_offset fields for safe toggling
- extract_todos function parses GFM task list checkboxes with support for [ ], [x], and [X] states
- Fence detection skips checkboxes inside ``` and ~~~ code blocks
- Blockquote detection skips checkboxes inside > quoted text  
- Regex pattern supports optional list markers (-, *, +) and leading whitespace
- LazyLock optimization compiles regex once at startup for performance
- Helper functions extracted following note_rewrite.rs pattern

## Task Commits

TDD cycle produced 2 atomic commits:

1. **RED: Add failing tests** - `c53cfa7` (test)
   - 10 test cases covering basic patterns, edge cases, and skipping logic
   - Tests verify TodoItem fields and precise char_offset calculation

2. **GREEN: Implement extraction** - *Included in 0429968 (05-02 commit)*
   - Implementation was bundled with 05-02's toggle functionality
   - All 10 extraction tests pass

3. **REFACTOR: Optimize and extract helpers** - `0a05c9b` (refactor)
   - LazyLock for regex compilation
   - is_fence_toggle and is_blockquote helpers

## Files Created/Modified

- `app/src-tauri/src/domain/todo.rs` - TodoItem struct and extract_todos function
- `app/src-tauri/src/domain/todo/tests.rs` - 10 test cases for extraction logic
- `app/src-tauri/Cargo.toml` - Added regex dependency
- `app/src-tauri/src/domain/mod.rs` - Added todo module

## Decisions Made

**GREEN commit bundled with 05-02:** The extract_todos implementation was included in commit 0429968 (feat(05-02): implement safe checkbox toggle with verification) rather than as a separate feat(05-01) commit. This was a workflow deviation but the functionality was delivered correctly and all tests pass.

**Regex over markdown parser:** Chose regex pattern matching over pulldown-cmark or comrak. Simple checkbox patterns don't require full AST parsing.

**LazyLock for performance:** Regex compilation is expensive. LazyLock ensures it happens once at startup rather than on every extract_todos call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added regex dependency**

- **Found during:** GREEN phase (implementing extract_todos)
- **Issue:** regex crate not in Cargo.toml, compilation would fail
- **Fix:** Added `regex = "1"` to dependencies
- **Files modified:** app/src-tauri/Cargo.toml
- **Verification:** Cargo build succeeds
- **Committed in:** c53cfa7 (RED commit included dependency for compilation)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency)  
**Impact on plan:** Necessary for compilation. No scope creep.

## Issues Encountered

**GREEN commit bundled with 05-02:** The implementation phase was combined with plan 05-02's work in a single commit. While this is a workflow deviation from TDD best practices (separate commits per phase), the functionality was correctly implemented and all tests pass. The REFACTOR phase was executed separately as intended.

## Next Phase Readiness

Ready for 05-02 (safe checkbox toggle). The extract_todos function provides:
- TodoItem with line_number and char_offset for precise toggle targeting
- note_stem for identifying source file
- checked state for determining toggle direction

Fence and blockquote helpers are available for reuse in toggle logic if needed.

---

*Phase: 05-todos-extract,-browse,-toggle*  
*Completed: 2026-02-02*
