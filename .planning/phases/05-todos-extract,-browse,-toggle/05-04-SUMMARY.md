---
phase: 05-todos-extract,-browse,-toggle
plan: 04
subsystem: api
tags: [rust, tauri, typescript, commands, api-wrappers]

# Dependency graph
requires:
  - phase: 05-todos-extract,-browse,-toggle
    provides: extract_todos and toggle_checkbox_in_memory functions from 05-01 and 05-02
provides:
  - Tauri commands list_todos and toggle_todo
  - Frontend TypeScript API wrappers in api/todos.ts
  - Complete backend-to-frontend integration for todo operations
affects: [05-05-ui-todo-list]

# Tech tracking
tech-stack:
  added: []
  patterns: [Tauri command pattern with Mutex<WorkspaceService>, CommandResult wrapper, DTO pattern with camelCase serialization]

key-files:
  created: 
    - app/src-tauri/src/commands/todos.rs
    - app/src/api/todos.ts
  modified: 
    - app/src-tauri/src/services/workspace_service.rs
    - app/src-tauri/src/commands/mod.rs
    - app/src-tauri/src/lib.rs
    - app/src-tauri/src/commands/notes.rs
    - app/src-tauri/src/commands/workspace.rs

key-decisions:
  - "Filter to open todos only in list_todos (checked=false) per TODO-01 requirement"
  - "Use atomic_write_note for toggle_todo to ensure safe file writes"
  - "DTO pattern with TodoItemDto for frontend compatibility"
  - "CommandResult wrapper for consistent error handling"

patterns-established:
  - "Tauri command pattern: lock service, call method, map result to CommandResult"
  - "DTO conversion: domain types → DTO with From trait → camelCase JSON serialization"
  - "API wrapper pattern: invoke → unwrap CommandResult → throw custom error on failure"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 5 Plan 04: Backend Commands and Frontend API Summary

**Complete integration layer: Tauri commands expose todo operations (list, toggle) with type-safe TypeScript wrappers using CommandResult pattern and atomic writes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T17:02:43Z
- **Completed:** 2026-02-02T17:06:26Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- WorkspaceService gained list_todos and toggle_todo methods
- list_todos filters to open todos only (checked=false) per requirement
- toggle_todo uses atomic_write_note for safe file modification
- Tauri commands list_todos and toggle_todo registered in invoke handler
- TodoItemDto with camelCase serialization for frontend compatibility
- Frontend api/todos.ts with listTodos and toggleTodo wrappers
- Custom TodoApiError class for structured error handling
- Complete backend-to-frontend integration ready for UI implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add workspace service methods** - `dea2745` (feat)
   - list_todos and toggle_todo methods in WorkspaceService
   - InvalidTodoToggle and NoteNotFound error variants
   - Error mapping updated in notes and workspace commands

2. **Task 2: Create Tauri commands** - `cbe7e37` (feat)
   - commands/todos.rs with list_todos and toggle_todo
   - TodoItemDto with camelCase serialization
   - Commands registered in lib.rs invoke handler

3. **Task 3: Create frontend API wrappers** - `207a20b` (feat)
   - api/todos.ts with listTodos and toggleTodo functions
   - TodoItem type matching backend DTO
   - TodoApiError for structured error handling

## Files Created/Modified

- `app/src-tauri/src/commands/todos.rs` - Tauri commands for todo operations
- `app/src/api/todos.ts` - Frontend TypeScript API wrappers
- `app/src-tauri/src/services/workspace_service.rs` - Added list_todos and toggle_todo methods
- `app/src-tauri/src/commands/mod.rs` - Added todos module
- `app/src-tauri/src/lib.rs` - Registered list_todos and toggle_todo commands
- `app/src-tauri/src/commands/notes.rs` - Updated error mapping
- `app/src-tauri/src/commands/workspace.rs` - Updated error mapping
- `app/src/utils/todoGrouping.test.ts` - Fixed unused import

## Decisions Made

**Open todos only in list_todos:** Following Plan 05-03's requirement that TODO-01 shows unchecked todos, list_todos filters to `!todo.checked` by default. This avoids sending completed todos to the frontend unnecessarily.

**Atomic writes for toggle:** toggle_todo uses the existing atomic_write_note function to ensure safe file modification even under concurrent access or system interruptions.

**DTO pattern for serialization:** TodoItemDto acts as the serialization boundary with `#[serde(rename_all = "camelCase")]`, keeping domain types clean while matching JavaScript conventions.

**CommandResult wrapper:** All commands use CommandResult<T> for consistent error handling, matching the existing pattern from workspace and notes commands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added error mappings for new error variants**

- **Found during:** Task 1 verification (cargo check)
- **Issue:** Rust exhaustive pattern matching required handling InvalidTodoToggle and NoteNotFound in existing map_error_code functions
- **Fix:** Added error code mappings in commands/notes.rs and commands/workspace.rs
- **Files modified:** app/src-tauri/src/commands/notes.rs, app/src-tauri/src/commands/workspace.rs
- **Verification:** cargo check passes without errors
- **Committed in:** dea2745 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed unused TodoGroup import in test file**

- **Found during:** Task 3 verification (npm run build)
- **Issue:** TypeScript compilation error: 'TodoGroup' is declared but its value is never read
- **Fix:** Removed unused TodoGroup from import in todoGrouping.test.ts
- **Files modified:** app/src/utils/todoGrouping.test.ts
- **Verification:** npm run build succeeds
- **Committed in:** 207a20b (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)  
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered

None - both blocking issues were resolved automatically during verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 05-05 (Todo List UI). The integration layer is complete:

- Backend can list all open todos from workspace notes
- Backend can toggle specific checkboxes using atomic writes
- Frontend has type-safe API wrappers with structured error handling
- TodoItem includes all location tracking (stem, line, offset) needed for safe toggle

**Blockers:** None

**Available for UI:**
- `listTodos()` → TodoItem[] with text, checked, noteStem, lineNumber, charOffset
- `toggleTodo(stem, lineNumber, charOffset)` → boolean (new state)
- TodoApiError for error handling in UI

---

*Phase: 05-todos-extract,-browse,-toggle*  
*Completed: 2026-02-02*
