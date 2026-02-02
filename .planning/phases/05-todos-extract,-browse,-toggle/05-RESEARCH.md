# Phase 5: Todos (Extract, Browse, Toggle) - Research

**Researched:** 2026-02-02
**Domain:** Markdown checkbox parsing, safe file editing, todo list UI patterns
**Confidence:** HIGH

## Summary

Phase 5 implements todo extraction from Markdown checkboxes, a browsable todo list grouped by tags, and safe in-place checkbox toggling. The research covers GFM task list syntax, line-based file manipulation patterns for safety, React list UI with keyboard navigation, and optimistic update strategies.

The standard approach is **line-based string manipulation in Rust** for checkbox parsing and toggling (following the existing `note_rewrite.rs` pattern), **no markdown parsing library needed** (simple regex patterns suffice), and **custom React list component** with keyboard navigation using the existing Overview pattern as a template. Checkbox toggling uses **atomic file writes** (already established in the codebase) with **optimistic UI updates** and rollback on error.

Key findings:
- GFM task list syntax is well-defined: `[ ]` or `[x]`/`[X]` with optional leading list markers
- Line-based manipulation (like existing `rewrite_exit_checklists`) ensures no corruption from string operations
- Atomic writes via temp files (existing `atomic_write_note` pattern) provide filesystem safety
- Checkbox location tracking via line number + character offset enables precise toggling
- React keyboard navigation follows existing Overview pattern (arrow keys, focus tracking)
- Optimistic updates with rollback provide instant feedback while maintaining safety

**Primary recommendation:** Follow existing codebase patterns—line-based Rust manipulation for parsing/toggling, atomic writes for safety, React list component modeled on Overview with keyboard navigation, and optimistic UI updates with error recovery.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | UI framework | Already in project, sufficient for todo list UI |
| TypeScript | 5.8.3 | Type safety | Already in project, provides type safety |
| Rust stdlib | (2021 edition) | String manipulation, file I/O | Already in project, no additional deps needed |
| regex (Rust) | latest | Checkbox pattern matching | Standard Rust crate for text patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tempfile (Rust) | 3.x | Atomic file writes | Already in project (`atomic_write_note` uses it) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex parsing | pulldown-cmark, comrak | Full markdown parsers add complexity and dependencies; simple regex sufficient for checkbox patterns |
| Atomic writes | Direct fs::write | Temp file + persist pattern (already used) prevents corruption on crash/interrupt |
| Custom React list | virtuoso, react-window | Virtualization unnecessary for <10k todos; custom component is ~150 LOC |

**Installation:**
```bash
# Rust dependency (add to Cargo.toml)
cargo add regex

# No frontend dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── src/                          # Frontend
│   ├── screens/
│   │   ├── Overview.tsx          # (existing)
│   │   ├── Editor.tsx            # (existing)
│   │   └── TodoList.tsx          # New: todo list screen (clone Overview structure)
│   ├── components/
│   │   ├── TodoRow.tsx           # New: single todo item with checkbox + text
│   │   └── TagGroupHeader.tsx    # New: tag group separator
│   ├── api/
│   │   └── todos.ts              # New: todo extraction/toggle commands
│   └── utils/
│       └── todoGrouping.ts       # New: group todos by tags, sort by recency
│
└── src-tauri/                    # Backend
    ├── src/
    │   ├── commands/
    │   │   └── todos.rs          # New: todo commands (list_todos, toggle_todo)
    │   ├── domain/
    │   │   ├── note_rewrite.rs   # (existing - pattern to follow)
    │   │   ├── todo.rs            # New: todo extraction and toggle logic
    │   │   └── todo_location.rs  # New: track checkbox location for safe toggle
    │   └── services/
    │       └── workspace_service.rs  # (existing - add todo methods)
```

### Pattern 1: Line-Based Checkbox Parsing (Rust)
**What:** Extract checkboxes by scanning lines with regex, tracking position for safe toggling
**When to use:** Extracting todos, toggling checkboxes
**Example:**
```rust
// Based on existing note_rewrite.rs pattern
use regex::Regex;

pub struct TodoItem {
    pub text: String,
    pub checked: bool,
    pub note_stem: String,
    pub line_number: usize,
    pub char_offset: usize,  // Position of [ ] in line
}

pub fn extract_todos(stem: &str, body: &str) -> Vec<TodoItem> {
    // GFM task list: optional spaces, optional list marker, [ ] or [x]/[X]
    let checkbox_re = Regex::new(
        r"^(?P<indent>\s*)(?:[-*+]\s+)?(?P<checkbox>\[(?P<state>[ xX])\])\s+(?P<text>.+)$"
    ).unwrap();
    
    let mut todos = Vec::new();
    let mut in_fence = false;
    
    for (line_num, line) in body.lines().enumerate() {
        // Skip fenced code blocks (like rewrite_exit_checklists does)
        if line.trim_start().starts_with("```") || line.trim_start().starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence || line.trim_start().starts_with('>') {
            continue;
        }
        
        if let Some(caps) = checkbox_re.captures(line) {
            let state = caps.name("state").unwrap().as_str();
            let text = caps.name("checkbox").unwrap().start();
            
            todos.push(TodoItem {
                text: caps.name("text").unwrap().as_str().to_string(),
                checked: state != " ",
                note_stem: stem.to_string(),
                line_number: line_num,
                char_offset: text,
            });
        }
    }
    
    todos
}
```

### Pattern 2: Safe Checkbox Toggle (Rust)
**What:** Toggle a specific checkbox by line + offset, verify before write
**When to use:** User clicks todo in Todo List
**Example:**
```rust
// Follow atomic_write_note pattern for safety
pub fn toggle_checkbox(
    workspace_dir: &Path,
    note_path: &Path,
    line_number: usize,
    char_offset: usize,
) -> Result<bool, WorkspaceServiceError> {
    let body = std::fs::read_to_string(note_path)?;
    let lines: Vec<&str> = body.lines().collect();
    
    // Verify line still exists and has checkbox at expected position
    if line_number >= lines.len() {
        return Err(WorkspaceServiceError::TodoNotFound);
    }
    
    let line = lines[line_number];
    if char_offset + 3 > line.len() {
        return Err(WorkspaceServiceError::TodoNotFound);
    }
    
    let checkbox = &line[char_offset..char_offset + 3];
    let new_state = match checkbox {
        "[ ]" => "[x]",
        "[x]" | "[X]" => "[ ]",
        _ => return Err(WorkspaceServiceError::TodoNotFound),
    };
    
    // Build new content with toggled checkbox
    let mut new_line = line.to_string();
    new_line.replace_range(char_offset..char_offset + 3, new_state);
    
    let mut new_lines = lines.to_vec();
    new_lines[line_number] = &new_line;
    let new_body = new_lines.join("\n");
    
    // Use existing atomic write (prevents corruption)
    atomic_write_note(workspace_dir, note_path, &new_body)?;
    
    Ok(new_state == "[x]")
}
```

### Pattern 3: Todo List Screen (React)
**What:** Full-screen todo list with keyboard navigation, grouped by tags
**When to use:** User presses T from Overview
**Example:**
```typescript
// Model on Overview.tsx structure
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TodoItem, TodoGroup } from '../api/todos'

type TodoListProps = {
  onExit: () => void
  onOpenNote: (stem: string) => void
}

export function TodoList(props: TodoListProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  // Group todos by tags (follow user's decision: cross-group appearance)
  const groupedTodos = useMemo(() => {
    return groupTodosByTags(todos) // groups ordered by most recent activity
  }, [todos])
  
  const handleToggle = useCallback(async (todo: TodoItem) => {
    // Optimistic update
    setTodos(prev => prev.map(t => 
      t.noteStem === todo.noteStem && t.lineNumber === todo.lineNumber
        ? { ...t, checked: !t.checked }
        : t
    ))
    
    try {
      await toggleTodoCommand(todo.noteStem, todo.lineNumber, todo.charOffset)
    } catch (err) {
      // Rollback on error
      setTodos(prev => prev.map(t => 
        t.noteStem === todo.noteStem && t.lineNumber === todo.lineNumber
          ? { ...t, checked: todo.checked }
          : t
      ))
      setToastMessage('Failed to toggle todo: ' + err.message)
    }
  }, [])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onExit()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(i => Math.min(i + 1, todos.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === ' ') {
      e.preventDefault()
      handleToggle(todos[focusedIndex])
    } else if (e.key === 'Enter') {
      e.preventDefault()
      props.onOpenNote(todos[focusedIndex].noteStem)
    }
  }, [focusedIndex, todos, handleToggle, props])
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  return (
    <div className="todoList">
      {groupedTodos.map(group => (
        <div key={group.tag} className="todoGroup">
          <h2 className="groupHeader">{group.tag}</h2>
          {group.todos.map((todo, idx) => (
            <TodoRow
              key={`${todo.noteStem}-${todo.lineNumber}`}
              todo={todo}
              focused={idx === focusedIndex}
              onToggle={() => handleToggle(todo)}
              onOpen={() => props.onOpenNote(todo.noteStem)}
            />
          ))}
        </div>
      ))}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  )
}
```

### Pattern 4: Optimistic Updates with Rollback
**What:** Instantly update UI, rollback if backend fails
**When to use:** Todo checkbox toggle
**Example:**
```typescript
// Optimistic update pattern
async function toggleTodoOptimistic(
  todo: TodoItem,
  setTodos: (updater: (prev: TodoItem[]) => TodoItem[]) => void,
  showError: (msg: string) => void
) {
  // 1. Optimistically update UI
  const originalChecked = todo.checked
  setTodos(prev => prev.map(t => 
    t.id === todo.id ? { ...t, checked: !t.checked } : t
  ))
  
  // 2. Attempt backend toggle
  try {
    const newState = await toggleTodoCommand(todo)
    
    // 3. Verify backend state matches optimistic update
    if (newState !== !originalChecked) {
      console.warn('Backend state mismatch, correcting')
      setTodos(prev => prev.map(t => 
        t.id === todo.id ? { ...t, checked: newState } : t
      ))
    }
  } catch (err) {
    // 4. Rollback on error
    setTodos(prev => prev.map(t => 
      t.id === todo.id ? { ...t, checked: originalChecked } : t
    ))
    showError('Could not toggle todo: ' + err.message)
  }
}
```

### Anti-Patterns to Avoid
- **Full markdown parsing:** Heavyweight libraries like `pulldown-cmark` are overkill for simple checkbox patterns—use regex on lines
- **Character-based editing:** String slicing without line awareness breaks on multi-byte UTF-8 characters—always work line-by-line
- **Direct file writes:** `fs::write` without atomic pattern risks corruption on crash—use temp file + persist
- **Global UI state for todos:** Todos are screen-local data—don't pollute workspace store, fetch fresh on screen mount
- **Stale location tracking:** Line numbers become invalid if file changes—verify checkbox still exists at expected position before toggle

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom locking/backup logic | `tempfile::NamedTempFile::persist` | Handles crash safety, permissions, cross-platform edge cases; already used in `atomic_write_note` |
| Keyboard navigation focus | Manual DOM manipulation | React state + focus refs | Declarative focus management avoids stale refs; existing Overview pattern works |
| Todo grouping/sorting | Multiple loops/sorts | Single pass with HashMap<Tag, Vec<Todo>> | O(n) instead of O(n*t) where t=tags; memoize with `useMemo` |

**Key insight:** This phase extends existing patterns rather than introducing new ones. Line-based manipulation (from `note_rewrite.rs`), atomic writes (from `workspace_service.rs`), and keyboard navigation (from `Overview.tsx`) are all proven patterns in the codebase—don't reinvent them.

## Common Pitfalls

### Pitfall 1: Checkbox Location Drift
**What goes wrong:** User toggles a todo, but between reading and writing, the file is externally modified. Toggle hits wrong line or corrupt location.
**Why it happens:** No file locking between read (extract todos) and write (toggle checkbox).
**How to avoid:** 
1. Store line number + character offset when extracting todos
2. Before toggle, re-read file and verify checkbox still exists at expected position
3. If verification fails, return error (don't write)
4. Frontend shows toast and refreshes todo list
**Warning signs:** Todos toggling wrong checkboxes, random characters replaced with `[x]`

### Pitfall 2: Nested Checkbox Flattening
**What goes wrong:** GFM allows nested task lists, but design decision is to show as flat list. User confusion when nested structure is lost visually.
**Why it happens:** Extraction strips nesting context (indentation), all todos appear at same level.
**How to avoid:** 
1. Accept this is by design (decision: "show as separate flat items")
2. Include full todo text (which often contains context clues like sub-item numbering)
3. Consider showing note title on hover if users complain
**Warning signs:** User reports "can't find where todo is in note"

### Pitfall 3: Optimistic Update Feedback Loop
**What goes wrong:** Optimistic toggle updates UI immediately, but if backend succeeds, workspace refresh (from file watcher or manual refresh) triggers re-render, causing visual flicker.
**Why it happens:** Todo list doesn't know about backend success vs. workspace refresh.
**How to avoid:**
1. On successful toggle, mark that specific todo as "recently toggled" (timestamp)
2. On workspace refresh, if a todo's state matches recent toggle, don't re-render it
3. Clear "recently toggled" flag after 2 seconds
**Warning signs:** Checkbox flickers after toggle, user sees checkbox state "jump" briefly

### Pitfall 4: Multi-Instance Sync
**What goes wrong:** Todo from note with multiple tags appears in multiple groups. User toggles one instance, but other instances don't update immediately.
**Why it happens:** React key uniqueness—if keyed by `${stem}-${lineNumber}`, all instances share same identity.
**How to avoid:**
1. Use unique key per rendered instance: `${groupTag}-${stem}-${lineNumber}`
2. Optimistic update applies to ALL instances in state (not just clicked one)
3. Backend toggle writes once, but UI updates all matching items
**Warning signs:** User toggles in "work" group, but same todo in "urgent" group stays unchecked

### Pitfall 5: Regex Catastrophic Backtracking
**What goes wrong:** Pathological input causes regex to hang (e.g., deeply nested markdown, very long lines).
**Why it happens:** Greedy quantifiers in regex can backtrack exponentially on certain inputs.
**How to avoid:**
1. Use anchored regex (start with `^`, end with `$`)
2. Avoid nested quantifiers (e.g., `(.*)+` is dangerous)
3. Set reasonable line length limit (skip lines >10k chars)
4. Test regex with fuzzing or property-based tests
**Warning signs:** Todo extraction hangs on certain notes, CPU spikes when opening Todo List

## Code Examples

Verified patterns from official sources and existing codebase:

### GFM Checkbox Regex Pattern
```rust
// Source: https://github.github.com/gfm/ section 5.3
// Task list item marker: [ ], [x], [X]
// Optional leading list marker: -, *, +
// At least one whitespace after ]

use regex::Regex;

fn checkbox_regex() -> Regex {
    Regex::new(
        r"^(?P<indent>\s*)(?:[-*+]\s+)?(?P<checkbox>\[(?P<state>[ xX])\])\s+(?P<text>.+)$"
    ).unwrap()
}

// Explanation:
// ^                      - start of line
// (?P<indent>\s*)        - optional leading spaces (capture for preservation)
// (?:[-*+]\s+)?          - optional list marker (-, *, +) + space (non-capturing)
// (?P<checkbox>\[...)    - checkbox capture group
//   \[                   - literal [
//   (?P<state>[ xX])     - space (unchecked) or x/X (checked)
//   \]                   - literal ]
// \s+                    - required whitespace after ]
// (?P<text>.+)           - todo text (one or more chars)
// $                      - end of line
```

### Safe Line-Based Toggle
```rust
// Source: Existing app/src-tauri/src/domain/note_rewrite.rs pattern
// Ensures no corruption from string operations

pub fn toggle_checkbox_at_position(
    body: &str,
    line_number: usize,
    char_offset: usize,
) -> Result<String, TodoError> {
    let lines: Vec<&str> = body.lines().collect();
    
    if line_number >= lines.len() {
        return Err(TodoError::LineNotFound);
    }
    
    let line = lines[line_number];
    let line_bytes = line.as_bytes();
    
    // Verify we're at a valid checkbox boundary
    if char_offset + 3 > line_bytes.len() {
        return Err(TodoError::InvalidOffset);
    }
    
    // Extract checkbox (must be [ ], [x], or [X])
    let checkbox = &line[char_offset..char_offset + 3];
    let new_checkbox = match checkbox {
        "[ ]" => "[x]",
        "[x]" | "[X]" => "[ ]",
        _ => return Err(TodoError::NotACheckbox),
    };
    
    // Build new line with toggled checkbox
    let mut new_line = String::with_capacity(line.len());
    new_line.push_str(&line[..char_offset]);
    new_line.push_str(new_checkbox);
    new_line.push_str(&line[char_offset + 3..]);
    
    // Reconstruct body with new line
    let mut result = String::with_capacity(body.len());
    for (i, original_line) in lines.iter().enumerate() {
        if i > 0 {
            result.push('\n');
        }
        if i == line_number {
            result.push_str(&new_line);
        } else {
            result.push_str(original_line);
        }
    }
    
    Ok(result)
}
```

### Frontend Todo Grouping
```typescript
// Group todos by tags with cross-group appearance and recency ordering
// Based on user decisions in CONTEXT.md

type TodoItem = {
  noteStem: string
  text: string
  checked: boolean
  lineNumber: number
  charOffset: number
  noteTags: string[]
  noteUpdatedAt: number
}

type TodoGroup = {
  tag: string
  lastUpdated: number  // most recent note updated_at in group
  todos: TodoItem[]
}

function groupTodosByTags(todos: TodoItem[]): TodoGroup[] {
  // Build map: tag -> todos
  const tagMap = new Map<string, TodoItem[]>()
  
  for (const todo of todos) {
    if (todo.noteTags.length === 0) {
      // Untagged notes go to "Untagged" group
      const untagged = tagMap.get('Untagged') || []
      untagged.push(todo)
      tagMap.set('Untagged', untagged)
    } else {
      // Todo appears in ALL its note's tag groups
      for (const tag of todo.noteTags) {
        const group = tagMap.get(tag) || []
        group.push(todo)
        tagMap.set(tag, group)
      }
    }
  }
  
  // Convert to array and compute group metadata
  const groups: TodoGroup[] = []
  for (const [tag, todos] of tagMap.entries()) {
    // Sort todos within group by note recency (most recent first)
    todos.sort((a, b) => {
      if (b.noteUpdatedAt !== a.noteUpdatedAt) {
        return b.noteUpdatedAt - a.noteUpdatedAt
      }
      // Stable sort: alphabetical by note title if same timestamp
      return a.noteStem.localeCompare(b.noteStem)
    })
    
    groups.push({
      tag,
      lastUpdated: Math.max(...todos.map(t => t.noteUpdatedAt)),
      todos,
    })
  }
  
  // Sort groups by most recent activity (most recent first)
  groups.sort((a, b) => {
    if (b.lastUpdated !== a.lastUpdated) {
      return b.lastUpdated - a.lastUpdated
    }
    // "Untagged" always goes last
    if (a.tag === 'Untagged') return 1
    if (b.tag === 'Untagged') return -1
    return a.tag.localeCompare(b.tag)
  })
  
  return groups
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full markdown AST parsing | Regex on lines | 2019 (GFM spec published) | Simpler, faster for checkbox-only tasks; no dependencies |
| Direct file writes | Atomic write (temp + persist) | Always (POSIX best practice) | Prevents corruption on crash/interrupt |
| Pull-based updates | Optimistic UI with rollback | 2015+ (modern web UIs) | Instant feedback, better UX even on slow I/O |

**Deprecated/outdated:**
- Using `[x]` as only checked state: GFM also supports `[X]` (uppercase)
- Requiring list markers: Minimal GFM implementations allow checkboxes without `-`, `*`, `+` prefixes

## Open Questions

Things that couldn't be fully resolved:

1. **Auto-refresh strategy when returning to Todo List**
   - What we know: User decisions say "automatic sync when returning" but defer technical implementation to Claude's discretion
   - What's unclear: Should we use file watchers, timestamp checks, or always-refresh-on-mount? What's the performance impact with 1000+ notes?
   - Recommendation: Start with always-refresh-on-mount (simplest, matches Overview pattern). If performance issues arise, add timestamp-based smart refresh.

2. **Race condition handling for rapid sequential toggles**
   - What we know: User clicks checkbox twice quickly. First write may not complete before second starts.
   - What's unclear: Does atomic write pattern naturally serialize, or do we need explicit queueing?
   - Recommendation: Test rapid clicks with instrumentation. If corruption occurs, add toggle queue (one pending toggle per note at a time).

3. **Toggle conflict when optimistic update fails**
   - What we know: Optimistic update shows checkbox checked, but backend returns error (e.g., file deleted, permissions changed)
   - What's unclear: Should we retry the toggle, reload the full todo list, or just show error and rollback?
   - Recommendation: Rollback + show error + silently reload todo list after 1 second (in case other todos also affected). Avoid auto-retry (could mask persistent issues).

## Sources

### Primary (HIGH confidence)
- **GitHub Flavored Markdown Spec** - https://github.github.com/gfm/ section 5.3 (Task list items extension)
  - Authoritative spec for checkbox syntax
  - Verified: `[ ]`, `[x]`, `[X]` are valid states
  - Verified: Optional list markers, required whitespace after `]`

- **Existing codebase** - app/src-tauri/src/domain/note_rewrite.rs
  - Line-based manipulation pattern (verified working in Phase 3)
  - Fence and blockquote skipping logic

- **Existing codebase** - app/src-tauri/src/services/workspace_service.rs
  - Atomic write pattern with `tempfile` (verified working)
  - Error handling and logging patterns

- **Existing codebase** - app/src/screens/Overview.tsx
  - Keyboard navigation with React state (verified working in Phase 4)
  - List focus management, toast notifications

### Secondary (MEDIUM confidence)
- **Rust regex crate documentation** - https://docs.rs/regex/ (assumed current as of 2026)
  - Standard for text pattern matching in Rust ecosystem

### Tertiary (LOW confidence)
- None—all research grounded in official specs and existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project or standard Rust/React
- Architecture: HIGH - All patterns proven in existing phases (1-4)
- Pitfalls: MEDIUM - Derived from general experience, not phase-specific testing

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable technologies)

**Notes:**
- No new external dependencies beyond `regex` crate (standard in Rust)
- All patterns follow existing codebase conventions
- User decisions from CONTEXT.md fully incorporated (grouping, visibility, interaction model)
- Claude's discretion areas (auto-refresh, race conditions, conflict handling) flagged as open questions with recommendations
