import { invoke } from '@tauri-apps/api/core'

export type WorkspaceFolderStatus = 'unassigned' | 'ok' | 'missing' | 'unreadable'

export type WorkspaceSlotState = {
  slot: number
  path: string | null
  status: WorkspaceFolderStatus | null
  errorKind: string | null
}

export type WorkspaceState = {
  activeSlot: number
  fallbackSlot: number | null
  slots: WorkspaceSlotState[]
}

export type NoteSummary = {
  stem: string
  title: string
  createdAt: number
  updatedAt: number | null
  tags: string[]
  filename?: string
}

export type CommandError = {
  code: string
  message: string
}

export type CommandResult<T> = {
  ok: boolean
  value: T | null
  error: CommandError | null
}

export class WorkspaceApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'WorkspaceApiError'
    this.code = code
  }
}

function unwrap<T>(res: CommandResult<T>): T {
  if (res.ok) return res.value as T
  const code = res.error?.code ?? 'unknown_error'
  const message = res.error?.message ?? 'Unknown error'
  throw new WorkspaceApiError(code, message)
}

export async function workspaceGetState(): Promise<WorkspaceState> {
  const res = await invoke<CommandResult<WorkspaceState>>('workspace_get_state')
  return unwrap(res)
}

export async function workspaceAssignSlot(slot: number, path: string): Promise<WorkspaceState> {
  const res = await invoke<CommandResult<WorkspaceState>>('workspace_assign_slot', { slot, path })
  return unwrap(res)
}

export async function workspaceSwitchSlot(slot: number): Promise<WorkspaceState> {
  const res = await invoke<CommandResult<WorkspaceState>>('workspace_switch_slot', { slot })
  return unwrap(res)
}

export async function workspaceListRootNotes(): Promise<string[]> {
  const res = await invoke<CommandResult<string[]>>('workspace_list_root_notes')
  return unwrap(res)
}

export async function workspaceListNotes(): Promise<NoteSummary[]> {
  const res = await invoke<CommandResult<NoteSummary[]>>('workspace_list_notes')
  return unwrap(res)
}

export async function workspaceCreateNote(): Promise<NoteSummary> {
  const res = await invoke<CommandResult<NoteSummary>>('workspace_create_note')
  return unwrap(res)
}
