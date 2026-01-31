import { useSyncExternalStore } from 'react'
import {
  WorkspaceApiError,
  type NoteSummary,
  type WorkspaceFolderStatus,
  type WorkspaceSlotState,
  workspaceAssignSlot,
  workspaceCreateNote,
  workspaceGetState,
  workspaceListNotes,
  workspaceSwitchSlot,
} from '../api/workspace'

export type ActiveWorkspaceStatus = 'ok' | 'unassigned' | 'missing' | 'unreadable'

export type WorkspaceSlot = {
  slot: number
  path: string | null
}

export type WorkspaceProblemKind = 'unassigned' | 'missing' | 'unreadable'

export type WorkspaceStoreState = {
  slots: WorkspaceSlot[]
  activeSlot: number
  activeStatus: ActiveWorkspaceStatus
  fallbackSlot: number | null
  loading: boolean
  errorMessage: string | null
  notes: NoteSummary[]

  problemSlot: number | null
  problemKind: WorkspaceProblemKind | null
}

function defaultSlots(): WorkspaceSlot[] {
  return Array.from({ length: 9 }, (_, idx) => ({ slot: idx + 1, path: null }))
}

function mapActiveStatus(status: WorkspaceFolderStatus | null | undefined): ActiveWorkspaceStatus {
  if (!status) return 'unassigned'
  if (status === 'ok') return 'ok'
  if (status === 'missing') return 'missing'
  if (status === 'unreadable') return 'unreadable'
  return 'unassigned'
}

function slotsFromState(slots: WorkspaceSlotState[]): WorkspaceSlot[] {
  return slots.map((s) => ({ slot: s.slot, path: s.path }))
}

function isWorkspaceApiError(err: unknown): err is WorkspaceApiError {
  return err instanceof Error && (err as WorkspaceApiError).name === 'WorkspaceApiError'
}

function problemKindFromErrorCode(code: string): WorkspaceProblemKind | null {
  if (code === 'unassigned_slot') return 'unassigned'
  if (code === 'workspace_missing') return 'missing'
  if (code === 'workspace_unreadable') return 'unreadable'
  return null
}

type Listener = () => void

function createWorkspaceStore() {
  let state: WorkspaceStoreState = {
    slots: defaultSlots(),
    activeSlot: 1,
    activeStatus: 'unassigned',
    fallbackSlot: null,
    loading: false,
    errorMessage: null,
    notes: [],
    problemSlot: null,
    problemKind: null,
  }

  const listeners = new Set<Listener>()
  const emit = () => listeners.forEach((l) => l())

  const setState = (next: Partial<WorkspaceStoreState>) => {
    state = { ...state, ...next }
    emit()
  }

  const applyWorkspaceState = (ws: {
    slots: WorkspaceSlotState[]
    activeSlot: number
    fallbackSlot: number | null
  }) => {
    const activeSlotState = ws.slots.find((s) => s.slot === ws.activeSlot)
    setState({
      slots: slotsFromState(ws.slots),
      activeSlot: ws.activeSlot,
      activeStatus: mapActiveStatus(activeSlotState?.status),
      fallbackSlot: ws.fallbackSlot,
    })
  }

  const refreshNotes = async () => {
    try {
      const notes = await workspaceListNotes()
      setState({ notes, errorMessage: null })
    } catch (err) {
      if (isWorkspaceApiError(err)) {
        const kind = problemKindFromErrorCode(err.code)
        if (kind) {
          setState({
            notes: [],
            activeStatus: kind,
            problemSlot: state.activeSlot,
            problemKind: kind,
            errorMessage: err.message,
          })
          return
        }
      }
      setState({ notes: [], errorMessage: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const boot = async () => {
    setState({ loading: true, errorMessage: null })
    try {
      const ws = await workspaceGetState()
      applyWorkspaceState(ws)
      setState({ loading: false })

      if (mapActiveStatus(ws.slots.find((s) => s.slot === ws.activeSlot)?.status) === 'ok') {
        await refreshNotes()
      } else {
        setState({ notes: [] })
      }
    } catch (err) {
      setState({
        loading: false,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        notes: [],
      })
    }
  }

  const assignSlot = async (slot: number, path: string) => {
    setState({ loading: true, errorMessage: null, problemSlot: null, problemKind: null })
    try {
      const ws = await workspaceAssignSlot(slot, path)
      applyWorkspaceState(ws)
      setState({ loading: false })
      await refreshNotes()
      return true
    } catch (err) {
      setState({
        loading: false,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      })
      return false
    }
  }

  const switchSlot = async (slot: number) => {
    setState({ loading: true, errorMessage: null, problemSlot: null, problemKind: null })
    try {
      const ws = await workspaceSwitchSlot(slot)
      applyWorkspaceState(ws)
      setState({ loading: false })
      await refreshNotes()
      return { ok: true as const }
    } catch (err) {
      if (isWorkspaceApiError(err)) {
        const kind = problemKindFromErrorCode(err.code)
        if (kind) {
          setState({
            loading: false,
            problemSlot: slot,
            problemKind: kind,
            errorMessage: err.message,
          })
          return { ok: false as const, code: err.code, message: err.message }
        }
      }

      setState({
        loading: false,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      })
      return { ok: false as const, code: 'unknown_error', message: 'Unknown error' }
    }
  }

  const createNote = async () => {
    setState({ loading: true, errorMessage: null, problemSlot: null, problemKind: null })
    try {
      const note = await workspaceCreateNote()
      setState({ loading: false })
      await refreshNotes()
      return { ok: true as const, note }
    } catch (err) {
      if (isWorkspaceApiError(err)) {
        const kind = problemKindFromErrorCode(err.code)
        if (kind) {
          setState({
            loading: false,
            notes: [],
            activeStatus: kind,
            problemSlot: state.activeSlot,
            problemKind: kind,
            errorMessage: err.message,
          })
          return { ok: false as const, message: err.message }
        }
      }

      setState({
        loading: false,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      })
      return { ok: false as const, message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  return {
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => state,
    actions: { boot, refreshNotes, assignSlot, switchSlot, createNote },
  }
}

const store = createWorkspaceStore()

export const workspaceActions = store.actions

export function useWorkspaceStore<T>(selector: (s: WorkspaceStoreState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()))
}
