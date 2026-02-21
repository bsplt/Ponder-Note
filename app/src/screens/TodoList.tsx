import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { listTodos, toggleTodo, type TodoItem } from '../api/todos'
import { TodoRow } from '../components/TodoRow'
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
  const rowRefsRef = useRef(new Map<number, HTMLDivElement>())
  
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
    const maxIndex = Math.max(0, flatTodos.length - 1)
    if (e.key === 'Escape') {
      props.onExit()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, maxIndex))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
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

  useEffect(() => {
    if (flatTodos.length === 0) return
    const clampedIndex = Math.min(focusedIndex, flatTodos.length - 1)
    if (clampedIndex !== focusedIndex) {
      setFocusedIndex(clampedIndex)
      return
    }

    const focusedRow = rowRefsRef.current.get(clampedIndex)
    if (!focusedRow) return
    focusedRow.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [flatTodos, focusedIndex])
  
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
            const rowIndex = globalIndex
            const isFocused = rowIndex === focusedIndex
            globalIndex++
            return (
              <TodoRow
                key={`${group.tag}-${todo.noteStem}-${todo.lineNumber}`}
                style={{ '--note-bg': `var(--color-slot-${noteColorSlot(todo.noteStem)})` } as CSSProperties}
                checked={todo.checked}
                text={todo.text}
                focused={isFocused}
                onToggle={() => handleToggle(todo)}
                showOpenButton
                onOpen={() => props.onOpenNote(todo.noteStem)}
                containerRef={(element) => {
                  if (!element) {
                    rowRefsRef.current.delete(rowIndex)
                    return
                  }
                  rowRefsRef.current.set(rowIndex, element)
                }}
              />
            )
          })}
        </div>
      ))}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  )
}
