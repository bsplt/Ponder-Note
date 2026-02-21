---
phase: 05-todos-extract,-browse,-toggle
plan: 03
subsystem: ui
tags: [typescript, vitest, testing, tdd, todo-list, grouping]

# Dependency graph
requires:
  - phase: 04-search-and-tags
    provides: NoteSummary type with tags field
provides:
  - groupTodosByTags function for organizing todos by tags
  - Cross-group appearance support (todos appear in all matching tag groups)
  - Recency-based ordering (groups and within-group)
  - Untagged group handling
affects: [05-04, 05-05]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [TDD red-green-refactor, helper function extraction]

key-files:
  created: 
    - app/src/utils/todoGrouping.ts
    - app/src/utils/todoGrouping.test.ts
    - app/vitest.config.ts
  modified:
    - app/package.json

key-decisions:
  - "Todos from multi-tag notes appear in ALL matching tag groups (cross-group appearance)"
  - "Groups ordered by most recent activity (mostRecentEdit field)"
  - "Within-group ordering by note recency, then alphabetically by title for stability"
  - "Untagged notes get dedicated 'Untagged' group always at bottom"
  - "Use createdAt as fallback when updatedAt is null"
  - "Skip orphan todos (note not found in notes array)"

patterns-established:
  - "TDD with vitest: write failing tests, implement to pass, refactor"
  - "Helper functions for complex sorting logic (compareTodosByNoteRecency, compareGroupsByRecency)"
  - "Memoization hints in comments for React integration (useMemo with [todos, notes] deps)"

# Metrics
duration: 4 min
completed: 2026-02-02
---

# Phase 5 Plan 3: Todo Grouping by Tags Summary

**Tested groupTodosByTags function with cross-group appearance and recency-based ordering using TDD red-green-refactor cycle**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T12:51:12Z
- **Completed:** 2026-02-02T12:55:43Z
- **Tasks:** 1 (TDD feature)
- **Files modified:** 4

## Accomplishments

- Installed and configured vitest test framework for the first time
- Implemented comprehensive test suite with 10 test cases covering all requirements
- Created groupTodosByTags function with proper type definitions (TodoItem, NoteSummary, TodoGroup)
- Implemented cross-group appearance (multi-tag notes appear in all matching groups)
- Implemented dual-level recency ordering (groups by mostRecentEdit, todos within groups by note recency)
- Handled edge cases: untagged notes, orphan todos, updatedAt null fallback, sort stability
- Followed TDD red-green-refactor cycle with atomic commits

## Task Commits

TDD cycle produced 2 atomic commits:

1. **RED Phase: Write failing tests** - `b1691d1` (test)
   - Installed vitest framework and configured
   - Created 10 comprehensive test cases
   - Tests failed as expected (module didn't exist)

2. **GREEN Phase: Implement to pass** - `7a38fd7` (feat)
   - Implemented groupTodosByTags with all required logic
   - Added helper functions (getNoteTimestamp, compareTodosByNoteRecency, compareGroupsByRecency)
   - All 10 tests passing
   - Code quality high from start (no separate refactor commit needed)

**Note:** The GREEN phase implementation was written with good quality, including extracted helper functions and clear documentation, so no separate REFACTOR commit was necessary.

## Files Created/Modified

- `app/src/utils/todoGrouping.ts` - Main grouping function with types and helpers (137 lines)
- `app/src/utils/todoGrouping.test.ts` - Comprehensive test suite with 10 test cases (189 lines)
- `app/vitest.config.ts` - Vitest configuration for test framework
- `app/package.json` - Added test script and vitest devDependency

## Decisions Made

**Cross-group appearance:**
- Todos from notes with multiple tags appear in ALL matching tag groups
- Same TodoItem instance shared across groups (efficient memory usage)

**Recency ordering:**
- Groups ordered by mostRecentEdit descending (most recent first)
- Untagged group always appears last regardless of recency
- Within each group, todos ordered by note recency descending
- Sort stability: alphabetical by note title when timestamps match

**Edge case handling:**
- Use createdAt fallback when updatedAt is null (consistent timestamp logic)
- Skip orphan todos where note not found (graceful degradation)
- Empty todos array returns empty groups array (early return optimization)

**Code quality:**
- Extract helper functions for complex sorting logic
- Add memoization hints for React integration
- Document performance characteristics (O(n*t) where n=todos, t=avg tags per note)

## Deviations from Plan

None - plan executed exactly as written through TDD red-green-refactor cycle.

## Issues Encountered

None - implementation followed plan smoothly with all test cases passing on first implementation.

## Next Phase Readiness

- groupTodosByTags function ready for integration in TodoList screen (plan 05-05)
- Function designed for memoization with React.useMemo
- All edge cases handled (orphans, untagged, null timestamps)
- No blockers for next plans

---
*Phase: 05-todos-extract,-browse,-toggle*
*Completed: 2026-02-02*
