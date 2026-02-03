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

export class NoteApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'NoteApiError'
    this.code = code
  }
}

function unwrap<T>(res: CommandResult<T>): T {
  if (res.ok) return res.value as T
  const code = res.error?.code ?? 'unknown_error'
  const message = res.error?.message ?? 'Unknown error'
  throw new NoteApiError(code, message)
}

export async function noteRead(stem: string): Promise<string> {
  const res = await invoke<CommandResult<string>>('note_read', { stem })
  return unwrap(res)
}

export type NoteSaveInput = {
  stem: string
  body: string
  rewriteOnExit: boolean
}

export async function noteSave({ stem, body, rewriteOnExit }: NoteSaveInput): Promise<void> {
  const res = await invoke<CommandResult<null>>('note_save', {
    stem,
    body,
    rewriteOnExit,
  })
  unwrap(res)
}

export async function noteDiscard(stem: string): Promise<void> {
  const res = await invoke<CommandResult<null>>('note_discard', { stem })
  unwrap(res)
}
