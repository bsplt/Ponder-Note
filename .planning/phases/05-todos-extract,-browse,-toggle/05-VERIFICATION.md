---
phase: 05-todos-extract,-browse,-toggle
verified: 2026-02-02T21:30:00Z
status: passed
score: 26/26 must-haves verified
re_verification: false
---

# Phase 5: Todos (Extract, Browse, Toggle) Verification Report

**Phase Goal:** Users can surface open todos across notes and complete them in-place from a dedicated todo list.

**Verified:** 2026-02-02T21:30:00Z  
**Status:** ✅ PASSED  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 7 success criteria from ROADMAP.md Phase 5 are verified:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | From overview, user can open the Todo List screen via T | ✓ VERIFIED | Overview.tsx handles T key (line 245), calls onOpenTodoList, App.tsx routes to 'todolist' screen |
| 2 | The Todo List shows todos extracted from Markdown checkbox patterns and shows only open todos by default | ✓ VERIFIED | extract_todos parses GFM checkboxes (todo.rs:27-59), list_todos filters to !checked (workspace_service.rs), TodoList.tsx loads via listTodos API |
| 3 | Todos are grouped by the parent note's tags and ordered within groups by recency | ✓ VERIFIED | groupTodosByTags implements cross-group appearance, recency ordering, Untagged group (todoGrouping.ts:45-137), 10 passing tests |
| 4 | Clicking a todo toggles its checked state in the source Markdown file and the Todo List reflects the new state | ✓ VERIFIED | toggle_checkbox_in_memory verifies position (todo.rs:69-117), toggle_todo uses atomic_write_note (workspace_service.rs:432-450), TodoList.tsx optimistic updates |
| 5 | A toggled todo remains visible in the Todo List until the user leaves the Todo List screen | ✓ VERIFIED | TodoList.tsx maintains local state, no auto-refresh except on error (lines 47-63) |
| 6 | From a todo row, user can open the originating note in the editor | ✓ VERIFIED | TodoList.tsx Enter key handler (line 79-83) and arrow button (line 120-128) call onOpenNote |
| 7 | If a safe toggle cannot be applied, the app does not write and surfaces an error; note contents remain uncorrupted | ✓ VERIFIED | toggle_checkbox_in_memory validates line/char bounds, pattern match before write (todo.rs:69-91), returns CheckboxNotFound on mismatch, atomic writes prevent corruption |

**Score:** 7/7 truths verified (100%)

### Required Artifacts

All 26 must-have artifacts from PLAN files verified:

#### Plan 05-01: Todo Extraction

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `app/src-tauri/src/domain/todo.rs` | TodoItem struct + extract_todos | ✓ | ✓ (129 lines, exports TodoItem, extract_todos, toggle_checkbox_in_memory, ToggleError) | ✓ (imported by commands/todos.rs, workspace_service.rs) | ✅ VERIFIED |
| `app/src-tauri/src/domain/todo/tests.rs` | Extraction test coverage | ✓ | ✓ (244 lines, 20+ tests) | ✓ (mod tests in todo.rs:128) | ✅ VERIFIED |

**Truth verification for Plan 05-01:**
- ✅ "Todo extraction identifies unchecked [ ] and checked [x]/[X] checkboxes" — CHECKBOX_REGEX captures state, checked = state != " " (todo.rs:44-50)
- ✅ "Todo extraction skips checkboxes inside fenced code blocks" — in_fence flag with is_fence_toggle (todo.rs:29-42)
- ✅ "Todo extraction skips checkboxes inside blockquotes" — is_blockquote checks > prefix (todo.rs:39-40, 65-67)
- ✅ "Each extracted todo includes line number and character offset for safe toggling" — TodoItem has line_number, char_offset fields (todo.rs:5-11, 48-54)

#### Plan 05-02: Safe Toggle

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `app/src-tauri/src/domain/todo.rs` | toggle_checkbox_in_memory + ToggleError | ✓ | ✓ (129 lines total, toggle function at 69-117) | ✓ (called by workspace_service.rs:446) | ✅ VERIFIED |
| `app/src-tauri/src/domain/todo/tests.rs` | Toggle test coverage | ✓ | ✓ (244 lines, 10+ toggle tests) | ✓ | ✅ VERIFIED |

**Truth verification for Plan 05-02:**
- ✅ "Toggle safely verifies checkbox exists at expected position before writing" — Checks line_number < lines.len(), char_offset + 3 <= line.len() (todo.rs:78-87)
- ✅ "Toggle returns error if file changed and checkbox not found" — match_and_toggle_checkbox returns CheckboxNotFound if pattern doesn't match (todo.rs:119-125)
- ✅ "Toggle uses atomic writes to prevent corruption" — toggle_todo calls atomic_write_note (workspace_service.rs:448)
- ✅ "Toggle correctly flips [ ] to [x] and [x]/[X] to [ ]" — match_and_toggle_checkbox matches all variants (todo.rs:120-123)

#### Plan 05-03: Todo Grouping

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `app/src/utils/todoGrouping.ts` | groupTodosByTags function | ✓ | ✓ (137 lines, exports TodoGroup, groupTodosByTags) | ✓ (imported by TodoList.tsx:3, used in useMemo:21-23) | ✅ VERIFIED |
| `app/src/utils/todoGrouping.test.ts` | Grouping test coverage | ✓ | ✓ (176 lines, 10 test cases) | ✓ (vitest configured) | ✅ VERIFIED |

**Truth verification for Plan 05-03:**
- ✅ "Todos from notes with multiple tags appear in all matching tag groups" — Loop over note.tags, add todo to each (todoGrouping.ts:77-89)
- ✅ "Within each group, todos are ordered by most recently modified note first" — Sort by noteTimestamp descending (todoGrouping.ts:104-118)
- ✅ "Untagged notes get their own 'Untagged' group at the bottom" — tags = ['Untagged'] if empty, sort places Untagged last (todoGrouping.ts:75-76, 122-134)
- ✅ "Tag groups are ordered by most recent activity" — Sort groups by mostRecentEdit descending (todoGrouping.ts:122-134)

#### Plan 05-04: Backend Commands & API

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `app/src-tauri/src/commands/todos.rs` | Tauri commands list_todos, toggle_todo | ✓ | ✓ (89 lines, exports list_todos, toggle_todo) | ✓ (registered in lib.rs:38-39) | ✅ VERIFIED |
| `app/src/api/todos.ts` | Frontend API wrappers | ✓ | ✓ (77 lines, exports listTodos, toggleTodo, TodoItem, TodoApiError) | ✓ (imported by TodoList.tsx:2, called at lines 37, 56) | ✅ VERIFIED |

**Truth verification for Plan 05-04:**
- ✅ "Backend can list all todos from workspace notes" — workspace_service.rs list_todos extracts from all notes, filters to open (lines 409-422)
- ✅ "Backend can toggle a specific checkbox by stem + line + offset" — workspace_service.rs toggle_todo takes stem, line_number, char_offset (lines 432-451)
- ✅ "Frontend can invoke list_todos command" — api/todos.ts listTodos calls invoke('list_todos') (line 45)
- ✅ "Frontend can invoke toggle_todo command" — api/todos.ts toggleTodo calls invoke('toggle_todo', params) (line 67-71)

**Key link verification for Plan 05-04:**
- ✅ commands/todos.rs → domain/todo.rs — Import at line 2, uses TodoItem type
- ✅ api/todos.ts → commands/todos.rs — invoke calls at lines 45, 67 with command names 'list_todos', 'toggle_todo'
- ✅ workspace_service.rs → domain/todo.rs — Import extract_todos, toggle_checkbox_in_memory at line 4, called at 413, 446

#### Plan 05-05: TodoList UI

| Artifact | Expected | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `app/src/screens/TodoList.tsx` | Main todo list screen with keyboard navigation | ✓ | ✓ (138 lines, exports TodoList) | ✓ (imported by App.tsx, rendered when screen === 'todolist' at line 164) | ✅ VERIFIED |
| `app/src/App.tsx` | TodoList screen routing | ✓ | ✓ (Contains 'todolist' screen type at line 10, routing at 164-167) | ✓ (handleOpenTodoList at 89, called from Overview.tsx) | ✅ VERIFIED |
| `app/src/styles.css` | TodoList styles | ✓ | ✓ (77 lines of todo styles starting at line 668: .todoList, .todoGroup, .todoRow, etc.) | ✓ (classes used in TodoList.tsx) | ✅ VERIFIED |

**Truth verification for Plan 05-05:**
- ✅ "User can open Todo List from Overview by pressing T" — Overview.tsx line 245: if (event.key === 'T' || event.key === 't'), calls onOpenTodoList
- ✅ "Todo List shows todos grouped by tags" — TodoList.tsx uses groupTodosByTags in useMemo (line 21-23), renders groups (line 104-133)
- ✅ "User can click a todo to toggle its checkbox" — TodoList.tsx onClick on todoRow (line 114) calls handleToggle
- ✅ "User can press Space to toggle focused todo" — TodoList.tsx handleKeyDown checks e.key === ' ' (line 74-78)
- ✅ "User can press Enter to open source note in Editor" — TodoList.tsx handleKeyDown checks e.key === 'Enter' (line 79-84), calls props.onOpenNote
- ✅ "User can press Escape to exit Todo List back to Overview" — TodoList.tsx handleKeyDown checks e.key === 'Escape' (line 66-67), calls props.onExit
- ✅ "Toggled todos update instantly across all groups (optimistic update)" — TodoList.tsx handleToggle updates state immediately (line 48-53), maps over all todos matching stem+line

**Key link verification for Plan 05-05:**
- ✅ Overview.tsx → App.tsx — T key handler at line 245-246 calls onOpenTodoList prop, which is handleOpenTodoList (App.tsx:89)
- ✅ TodoList.tsx → api/todos.ts — Import at line 2, calls listTodos (line 37), toggleTodo (line 56)
- ✅ TodoList.tsx → todoGrouping.ts — Import at line 3, useMemo calls groupTodosByTags (line 22)

#### Plan 05-06: Human Verification

Plan 05-06 is a verification-only plan (no artifacts). Human testing was completed and documented in 05-06-SUMMARY.md with all 11 test cases passing.

### Requirements Coverage

Phase 5 maps to requirements TODO-01 through TODO-06 and SAFE-02:

| Requirement | Description | Status | Supporting Evidence |
|-------------|-------------|--------|---------------------|
| TODO-01 | Extract todos from markdown checkbox patterns, show only open todos by default | ✅ SATISFIED | extract_todos (todo.rs:27-59), list_todos filters !checked (workspace_service.rs:420-422) |
| TODO-02 | From overview, open Todo List via T | ✅ SATISFIED | Overview.tsx T key handler (line 245), App routing to 'todolist' (line 164) |
| TODO-03 | Group todos by tags, order within groups by recency | ✅ SATISFIED | groupTodosByTags (todoGrouping.ts:45-137), 10 passing tests |
| TODO-04 | Clicking todo toggles checkbox in source file, UI reflects new state | ✅ SATISFIED | toggle_checkbox_in_memory + atomic_write_note + optimistic updates (TodoList.tsx:47-63) |
| TODO-05 | Toggled todo remains visible until user leaves Todo List | ✅ SATISFIED | TodoList maintains local state, no auto-refresh except on error (TodoList.tsx:47-63) |
| TODO-06 | From todo row, open originating note in editor | ✅ SATISFIED | Enter key handler (TodoList.tsx:79-84), arrow button (line 120-128) |
| SAFE-02 | Todo toggling never corrupts note content | ✅ SATISFIED | Position verification (todo.rs:78-91), atomic writes (workspace_service.rs:448), CheckboxNotFound on mismatch |

**Coverage:** 7/7 Phase 5 requirements satisfied (100%)

### Anti-Patterns Found

**Scan results:** Zero anti-patterns found in key files.

```bash
# Checked for TODO/FIXME/placeholder/stub patterns:
grep -E "TODO|FIXME|placeholder|not implemented|coming soon" \
  app/src-tauri/src/domain/todo.rs \
  app/src/utils/todoGrouping.ts \
  app/src-tauri/src/commands/todos.rs \
  app/src/api/todos.ts \
  app/src/screens/TodoList.tsx
# Result: 0 matches
```

**Early returns found:**
- `todoGrouping.ts:51` — `return []` for empty todos input (✅ Valid optimization, documented in code)

**No blockers, warnings, or problematic patterns detected.**

### Key Links Verification

Critical wiring verified end-to-end:

#### Flow 1: Overview → TodoList Screen

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Overview.tsx | App.tsx | T key handler calls onOpenTodoList prop | ✅ WIRED | Line 245-246 → handleOpenTodoList at App.tsx:89 |
| App.tsx | TodoList.tsx | setScreen('todolist') renders TodoList | ✅ WIRED | screen === 'todolist' at line 164 renders TodoList component |

#### Flow 2: TodoList → List Todos API → Backend

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| TodoList.tsx | api/todos.ts | loadTodos calls listTodos() | ✅ WIRED | Line 37: await listTodos() |
| api/todos.ts | commands/todos.rs | invoke('list_todos') | ✅ WIRED | Line 45: invoke with command name |
| commands/todos.rs | workspace_service.rs | svc.list_todos() | ✅ WIRED | Line 43: calls service method |
| workspace_service.rs | domain/todo.rs | extract_todos(&stem, &body) | ✅ WIRED | Line 413: calls domain function |

#### Flow 3: TodoList → Toggle API → Backend → File Write

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| TodoList.tsx | api/todos.ts | handleToggle calls toggleTodo() | ✅ WIRED | Line 56: await toggleTodo(stem, line, offset) |
| api/todos.ts | commands/todos.rs | invoke('toggle_todo', params) | ✅ WIRED | Line 67-71: invoke with stem, line, offset |
| commands/todos.rs | workspace_service.rs | svc.toggle_todo() | ✅ WIRED | Line 69: calls service method |
| workspace_service.rs | domain/todo.rs | toggle_checkbox_in_memory() | ✅ WIRED | Line 446: calls domain function |
| workspace_service.rs | atomic_write_note | atomic_write_note(&workspace_dir, &note_path, &new_body) | ✅ WIRED | Line 448: safe file write |

#### Flow 4: TodoList Grouping

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| TodoList.tsx | todoGrouping.ts | useMemo calls groupTodosByTags | ✅ WIRED | Line 21-23: grouped = useMemo(() => groupTodosByTags(todos, notes), [todos, notes]) |
| todoGrouping.ts | NoteSummary | Maps todos to note tags | ✅ WIRED | Line 54-90: builds noteMap, tagMap, cross-group appearance logic |

#### Flow 5: TodoList → Open Note in Editor

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| TodoList.tsx | App.tsx | Enter key or arrow button calls onOpenNote(stem) | ✅ WIRED | Line 82 (Enter), line 125 (button) call props.onOpenNote |
| App.tsx | Editor.tsx | handleOpenNoteFromTodoList finds note by stem, calls handleOpenNote | ✅ WIRED | App.tsx handleOpenNoteFromTodoList defined and passed to TodoList |

**All critical flows verified. No orphaned or unwired components.**

---

## Summary

**Phase 5 goal ACHIEVED.** All 7 success criteria verified, all 26 must-have artifacts exist and are substantive and wired, all 7 requirements satisfied.

**Implementation quality:**
- ✅ TDD approach followed (RED-GREEN-REFACTOR) for plans 05-01, 05-02, 05-03
- ✅ Comprehensive test coverage (20+ tests for extraction/toggle, 10 tests for grouping)
- ✅ Atomic writes ensure safety (SAFE-02 requirement)
- ✅ Position verification prevents corruption
- ✅ Optimistic UI updates for instant feedback
- ✅ Error recovery with auto-refresh
- ✅ Complete keyboard navigation (T, Arrow keys, Space, Enter, Escape)
- ✅ Cross-group appearance for multi-tag notes
- ✅ Recency-based ordering (groups and within-group)
- ✅ Consistent design language (matches Overview styles)

**No gaps, no blockers, no human verification required.**

**Ready for Phase 6 (Soft Delete).**

---

_Verified: 2026-02-02T21:30:00Z_  
_Verifier: Claude (gsd-verifier)_  
_Method: Goal-backward verification against must_haves in PLAN frontmatter_
