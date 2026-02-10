import { useCallback, useEffect, useMemo, useState } from 'react'
import { listTodos, toggleTodo, type TodoItem } from '../api/todos'
import { groupTodosByTags } from '../utils/todoGrouping'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { Toast } from '../components/Toast'
import { noteColorSlot } from '../utils/noteColor'

type TodoListProps = {
  onExit: () => void
  onOpenNote: (stem: string) => void
}

export function TodoList(props: TodoListProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  
  const notes = useWorkspaceStore((s) => s.notes)
  
  // Group todos by tags with cross-group appearance
  const grouped = useMemo(() => {
    return groupTodosByTags(todos, notes)
  }, [todos, notes])
  
  // Flatten grouped todos for keyboard navigation
  const flatTodos = useMemo(() => {
    return grouped.flatMap(g => g.todos)
  }, [grouped])
  
  useEffect(() => {
    loadTodos()
  }, [])
  
  const loadTodos = useCallback(async () => {
    try {
      setLoading(true)
      const items = await listTodos()
      setTodos(items)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setToastMessage(`Failed to load todos: ${message}`)
    } finally {
      setLoading(false)
    }
  }, [])
  
  const handleToggle = useCallback(async (todo: TodoItem) => {
    // Optimistic update - update ALL instances across groups
    setTodos(prev => prev.map(t =>
      t.noteStem === todo.noteStem && t.lineNumber === todo.lineNumber
        ? { ...t, checked: !t.checked }
        : t
    ))
    
    try {
      await toggleTodo(todo.noteStem, todo.lineNumber, todo.charOffset)
    } catch (err) {
      // Auto-refresh to current state after error (locked decision from CONTEXT.md)
      loadTodos()
      const message = err instanceof Error ? err.message : String(err)
      setToastMessage(`Failed to toggle todo: ${message}`)
    }
  }, [loadTodos])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onExit()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(i => Math.min(i + 1, flatTodos.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === ' ') {
      e.preventDefault()
      if (flatTodos[focusedIndex]) {
        handleToggle(flatTodos[focusedIndex])
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatTodos[focusedIndex]) {
        props.onOpenNote(flatTodos[focusedIndex].noteStem)
      }
    }
  }, [focusedIndex, flatTodos, handleToggle, props])
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  if (loading) {
    return <div className="todoList"><p>Loading todos...</p></div>
  }
  
  if (flatTodos.length === 0) {
    return <div className="todoList"><p>No open todos</p></div>
  }
  
  let globalIndex = 0
  
  return (
    <div className="todoList">
      {grouped.map(group => (
        <div key={group.tag} className="todoGroup">
          <h2 className="todoGroupHeader">{group.tag}</h2>
          {group.todos.map(todo => {
            const isFocused = globalIndex === focusedIndex
            globalIndex++
            return (
              <div
                key={`${group.tag}-${todo.noteStem}-${todo.lineNumber}`}
                className={`todoRow ${isFocused ? 'todoRowFocused' : ''}`}
                style={{ '--note-bg': `var(--color-slot-${noteColorSlot(todo.noteStem)})` } as React.CSSProperties}
                onClick={() => handleToggle(todo)}
              >
                <span className="todoCheckbox">{todo.checked ? '[x]' : '[ ]'}</span>
                <span className={`todoText ${todo.checked ? 'todoTextChecked' : ''}`}>
                  {todo.text}
                </span>
                <button
                  type="button"
                  className="todoOpenBtn"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onOpenNote(todo.noteStem)
                  }}
                >
                  →
                </button>
              </div>
            )
          })}
        </div>
      ))}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  )
}
