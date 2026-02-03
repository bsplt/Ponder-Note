import { invoke } from '@tauri-apps/api/core'

export type CommandError = {
  code: string
  message: string
}

export type CommandResult<T> = {
  ok: boolean
  value: T | null
  error: CommandError | null
}

export class TodoApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'TodoApiError'
    this.code = code
  }
}

function unwrap<T>(res: CommandResult<T>): T {
  if (res.ok) return res.value as T
  const code = res.error?.code ?? 'unknown_error'
  const message = res.error?.message ?? 'Unknown error'
  throw new TodoApiError(code, message)
}

export type TodoItem = {
  text: string
  checked: boolean
  noteStem: string
  lineNumber: number
  charOffset: number
}

/**
 * List all todos from notes in the active workspace.
 * Returns todos with location tracking for safe toggle.
 */
export async function listTodos(): Promise<TodoItem[]> {
  try {
    const result = await invoke<CommandResult<TodoItem[]>>('list_todos')
    return unwrap(result)
  } catch (err) {
    console.error('[listTodos] Failed:', err)
    throw new Error(`Failed to list todos: ${err}`)
  }
}

/**
 * Toggle a checkbox in a note at the specified position.
 * Returns the new checked state (true = checked, false = unchecked).
 * 
 * @param stem - Note stem (filename without .md)
 * @param lineNumber - Zero-based line number
 * @param charOffset - Character offset of '[' in checkbox
 */
export async function toggleTodo(
  stem: string,
  lineNumber: number,
  charOffset: number
): Promise<boolean> {
  try {
    const newState = await invoke<CommandResult<boolean>>('toggle_todo', {
      stem,
      lineNumber,
      charOffset,
    })
    return unwrap(newState)
  } catch (err) {
    console.error('[toggleTodo] Failed:', err)
    throw new Error(`Failed to toggle todo: ${err}`)
  }
}
