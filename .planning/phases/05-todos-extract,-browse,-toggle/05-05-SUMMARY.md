---
phase: 05-todos-extract,-browse,-toggle
plan: 05
subsystem: ui
tags: [typescript, react, keyboard-navigation, todos, grouping, optimistic-updates]

# Dependency graph
requires:
  - phase: 05-todos-extract,-browse,-toggle
    provides: listTodos and toggleTodo API from 05-04, groupTodosByTags from 05-03
provides:
  - TodoList screen component with full keyboard navigation
  - T key shortcut from Overview to open TodoList
  - Optimistic toggle updates across all group instances
  - Todo grouping by tags with cross-group appearance
affects: [user-workflow, keyboard-shortcuts]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic UI updates, keyboard navigation, cross-screen routing]

key-files:
  created: 
    - app/src/screens/TodoList.tsx
  modified:
    - app/src/App.tsx
    - app/src/screens/Overview.tsx
    - app/src/styles.css

key-decisions:
  - "T key from Overview opens TodoList (not from Editor - keeps Editor focused)"
  - "Optimistic updates apply to ALL instances across groups (cross-group sync)"
  - "Arrow keys navigate flattened list, groups are for display only"
  - "Space toggles focused todo, Enter opens source note in Editor"
  - "Escape returns to Overview"
  - "Auto-refresh on toggle error to restore correct state"

patterns-established:
  - "Screen routing pattern: handler in App, prop passed to screen, keyboard shortcut in source screen"
  - "Keyboard navigation with flattened list for focus tracking across visual groups"
  - "Optimistic UI updates with error recovery via full refresh"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 5 Plan 05: Todo List UI Summary

**Complete TodoList screen with keyboard navigation (T key from Overview), tag-based grouping, and optimistic toggle updates across all instances**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T17:08:41Z
- **Completed:** 2026-02-02T17:13:02Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created TodoList screen component with full keyboard navigation (Arrow keys, Space, Enter, Escape)
- Integrated TodoList into App routing with 'todolist' screen type
- T key in Overview opens TodoList screen (not available from Editor - keeps Editor focused)
- Groups todos by tags using groupTodosByTags utility (cross-group appearance for multi-tag notes)
- Flattened list for keyboard navigation across visual groups
- Optimistic toggle updates apply to ALL instances (if todo appears in multiple tag groups, toggling in one updates all)
- Error recovery: auto-refresh on toggle failure to restore correct state
- Opens source note in Editor with Enter key or arrow button
- Returns to Overview with Escape key
- Loading and empty states ("Loading todos..." / "No open todos")
- Toast notifications for errors
- Styles match Overview design language (same CSS variables, hover/focus states)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TodoList screen** - `78de2ce` (feat)
   - Full keyboard navigation implementation
   - Groups todos by tags with groupTodosByTags
   - Optimistic updates across all group instances
   - Toast error handling
   - Follows Overview.tsx patterns

2. **Task 2: Integrate TodoList routing** - `99ec37f` (feat)
   - Added 'todolist' to Screen type in App.tsx
   - T key handler in Overview.tsx
   - handleOpenTodoList and handleExitTodoList in App
   - handleOpenNoteFromTodoList for navigating to source note
   - Escape returns to Overview

3. **Task 3: Add TodoList styles** - `ebaa788` (feat)
   - .todoList, .todoGroup, .todoGroupHeader
   - .todoRow with hover and focus states
   - .todoRowFocused uses primary-border like Overview
   - .todoCheckbox, .todoText, .todoTextChecked
   - .todoOpenBtn with hover effect
   - Uses existing CSS variables for consistency

## Files Created/Modified

- `app/src/screens/TodoList.tsx` - Main TodoList screen component with keyboard navigation (138 lines)
- `app/src/App.tsx` - Added TodoList routing, handlers, and screen rendering
- `app/src/screens/Overview.tsx` - Added T key handler and onOpenTodoList prop
- `app/src/styles.css` - Added TodoList styles matching Overview design (77 lines)

## Decisions Made

**T key placement:** T key only works from Overview, not from Editor. This keeps Editor focused on note editing without additional keyboard shortcuts. Users press Escape to Overview, then T to see todos.

**Optimistic updates:** Toggling a todo immediately updates ALL instances across groups (same todo appears in multiple tag groups if note has multiple tags). On error, full list is refreshed to restore correct state.

**Keyboard navigation:** Arrow keys navigate a flattened list across all groups. Groups are visual organization only - focus flows continuously through all todos regardless of group boundaries.

**Space vs Click:** Both Space (keyboard) and Click (mouse) toggle todos. Enter and arrow button open source note in Editor.

**Error recovery:** On toggle failure, automatically refresh entire todo list to restore correct state. This is simpler and more reliable than trying to revert the optimistic update.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Toast component prop name**

- **Found during:** Task 1 verification (npm run build)
- **Issue:** TypeScript error - Toast expects `onClose` prop but I used `onDismiss`
- **Fix:** Changed `onDismiss={() => setToastMessage(null)}` to `onClose={() => setToastMessage(null)}`
- **Files modified:** app/src/screens/TodoList.tsx
- **Verification:** npm run build succeeds
- **Committed in:** 78de2ce (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed handleOpenNoteFromTodoList implementation**

- **Found during:** Task 2 verification (npm run build)
- **Issue:** TypeScript errors trying to use useWorkspaceStore.getState() inside JSX and implicit any type
- **Fix:** Created handleOpenNoteFromTodoList callback that uses notes from useWorkspaceStore hook, finds note by stem, calls handleOpenNote
- **Files modified:** app/src/App.tsx
- **Verification:** npm run build succeeds
- **Committed in:** 99ec37f (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed CSS syntax error from duplicate line**

- **Found during:** Task 3 verification (npm run build)
- **Issue:** Vite CSS warning about unbalanced braces - duplicate "grid-template-columns: 1fr;" line when appending TodoList styles
- **Fix:** Removed duplicate line 666
- **Files modified:** app/src/styles.css
- **Verification:** npm run build succeeds without warnings
- **Committed in:** ebaa788 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking issues)  
**Impact on plan:** All fixes necessary for compilation. No scope creep.

## Issues Encountered

None - all blocking issues were TypeScript/CSS errors resolved automatically during verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 05-06 (Visual verification and user testing). The TodoList UI is complete:

- TodoList screen fully functional with keyboard navigation
- T key shortcut from Overview
- Tag-based grouping with cross-group appearance
- Optimistic updates with error recovery
- Styles match Overview design language

**Blockers:** None

**Available for testing:**
- Press T from Overview to open TodoList
- Arrow keys to navigate, Space to toggle, Enter to open note, Escape to exit
- Visual verification of grouping, focus states, hover effects
- Test optimistic updates (toggle should be instant)

---

*Phase: 05-todos-extract,-browse,-toggle*  
*Completed: 2026-02-02*
