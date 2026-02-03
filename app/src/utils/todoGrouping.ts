/**
 * Todo grouping by tags with cross-group appearance and recency ordering.
 * 
 * Todos from notes with multiple tags appear in ALL matching tag groups.
 * Groups are ordered by most recent activity (most recently edited note first).
 * Within each group, todos are ordered by note recency, then alphabetically by title.
 * Untagged notes get their own "Untagged" group at the bottom.
 */

export type TodoItem = {
  text: string
  checked: boolean
  noteStem: string
  lineNumber: number
  charOffset: number
}

export type NoteSummary = {
  stem: string
  title: string
  createdAt: number
  updatedAt: number | null
  tags: string[]
}

export type TodoGroup = {
  tag: string
  todos: TodoItem[]
  mostRecentEdit: number  // For group ordering
}

/**
 * Groups todos by parent note tags with cross-group appearance and activity-based ordering.
 * 
 * Algorithm:
 * 1. Build note lookup map: stem -> NoteSummary
 * 2. Create tag -> todos map
 * 3. For each todo, find parent note
 * 4. For each tag in note.tags (or "Untagged" if empty):
 *    - Add todo to tag group
 *    - Track most recent edit in group
 * 5. Sort groups by mostRecentEdit descending, "Untagged" always last
 * 6. Within each group, sort todos by note recency then title
 */
export function groupTodosByTags(
  todos: TodoItem[],
  notes: NoteSummary[]
): TodoGroup[] {
  // Early return for empty todos
  if (todos.length === 0) {
    return []
  }

  // Build note lookup map: stem -> NoteSummary
  const noteMap = new Map<string, NoteSummary>()
  for (const note of notes) {
    noteMap.set(note.stem, note)
  }

  // Build tag -> todos map with mostRecentEdit tracking
  const tagMap = new Map<string, { todos: TodoItem[], mostRecentEdit: number }>()

  for (const todo of todos) {
    const note = noteMap.get(todo.noteStem)
    
    // Skip orphan todos (note not found)
    if (!note) {
      continue
    }

    // Use updatedAt if available, otherwise fallback to createdAt
    const noteTimestamp = note.updatedAt ?? note.createdAt

    // Determine which tags this todo belongs to
    const tags = note.tags.length > 0 ? note.tags : ['Untagged']

    for (const tag of tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { todos: [], mostRecentEdit: noteTimestamp })
      }

      const group = tagMap.get(tag)!
      group.todos.push(todo)
      
      // Track most recent edit in this group
      if (noteTimestamp > group.mostRecentEdit) {
        group.mostRecentEdit = noteTimestamp
      }
    }
  }

  // Convert to array of TodoGroup objects
  const groups: TodoGroup[] = []
  for (const [tag, { todos: groupTodos, mostRecentEdit }] of tagMap.entries()) {
    groups.push({
      tag,
      todos: groupTodos,
      mostRecentEdit,
    })
  }

  // Sort todos within each group by note recency (most recent first), then alphabetically by title
  for (const group of groups) {
    group.todos.sort((a, b) => {
      const noteA = noteMap.get(a.noteStem)!
      const noteB = noteMap.get(b.noteStem)!

      const timestampA = noteA.updatedAt ?? noteA.createdAt
      const timestampB = noteB.updatedAt ?? noteB.createdAt

      // Sort by timestamp descending (most recent first)
      if (timestampB !== timestampA) {
        return timestampB - timestampA
      }

      // If same timestamp, sort alphabetically by title (ascending)
      return noteA.title.localeCompare(noteB.title)
    })
  }

  // Sort groups by mostRecentEdit descending, but "Untagged" always last
  groups.sort((a, b) => {
    // "Untagged" always goes last
    if (a.tag === 'Untagged') return 1
    if (b.tag === 'Untagged') return -1

    // Sort by mostRecentEdit descending (most recent first)
    if (b.mostRecentEdit !== a.mostRecentEdit) {
      return b.mostRecentEdit - a.mostRecentEdit
    }

    // If same timestamp, sort alphabetically by tag name
    return a.tag.localeCompare(b.tag)
  })

  return groups
}
