import { useCallback, useMemo } from 'react'
import { confirmReplace, pickDirectory } from '../api/tauri'
import { useWorkspaceStore, workspaceActions } from '../stores/workspaceStore'
import { restoreAppInputFocus } from '../utils/windowFocus'

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const last = parts[parts.length - 1]
  return last.length ? last : path
}

function slotSubtitle(path: string | null): string {
  return path ?? '(no folder)'
}

export function Workspaces() {
  const slots = useWorkspaceStore((s) => s.slots)
  const activeSlot = useWorkspaceStore((s) => s.activeSlot)
  const activeStatus = useWorkspaceStore((s) => s.activeStatus)
  const fallbackSlot = useWorkspaceStore((s) => s.fallbackSlot)
  const loading = useWorkspaceStore((s) => s.loading)
  const errorMessage = useWorkspaceStore((s) => s.errorMessage)
  const problemSlot = useWorkspaceStore((s) => s.problemSlot)
  const problemKind = useWorkspaceStore((s) => s.problemKind)

  const hasAssigned = useMemo(() => slots.some((s) => s.path), [slots])
  const relaunchInvalid = activeStatus === 'missing' || activeStatus === 'unreadable'

  const onPickAndAssign = useCallback(
    async (slot: number) => {
      const selected = await pickDirectory()
      if (!selected) return
      await workspaceActions.assignSlot(slot, selected)
    },
    [/* stable */],
  )

  const onSwitchSlot = useCallback(
    async (slot: number, isActive: boolean) => {
      if (loading) return
      if (isActive) return
      await workspaceActions.switchSlot(slot)
    },
    [loading],
  )

  const onClickSlot = useCallback(
    async (slot: number, existingPath: string | null, isActive: boolean) => {
      if (loading) return
      try {
        if (existingPath) {
          await onSwitchSlot(slot, isActive)
        } else {
          await onPickAndAssign(slot)
        }
      } finally {
        await restoreAppInputFocus()
      }
    },
    [loading, onPickAndAssign, onSwitchSlot],
  )

  const onUnassignSlot = useCallback(
    async (slot: number) => {
      if (loading) return
      try {
        const ok = await confirmReplace(`Unassign folder from workspace slot ${slot}?`)
        if (!ok) return
        await workspaceActions.unassignSlot(slot)
      } finally {
        await restoreAppInputFocus()
      }
    },
    [loading],
  )

  return (
    <section className="panel workspacesPanel">
      <h2 className="panelTitle">Workspace slots</h2>
      {!hasAssigned ? (
        <p className="panelSubtitle">Assign a folder to any slot to get started.</p>
      ) : relaunchInvalid ? (
        <p className="panelSubtitle">
          The last active workspace can’t be opened. Choose a different slot or assign a new folder.
        </p>
      ) : (
        <p className="panelSubtitle">
          Click an assigned slot to switch workspaces, or click an unassigned slot to pick a folder.
        </p>
      )}

      {errorMessage ? <div className="inlineError">{errorMessage}</div> : null}

      <div className="slotGrid" role="list">
        {slots.map((s) => {
          const isActive = s.slot === activeSlot
          const isRelaunchError =
            isActive && (activeStatus === 'missing' || activeStatus === 'unreadable')
          const isSwitchError =
            s.slot === problemSlot && (problemKind === 'missing' || problemKind === 'unreadable')

          const isError = isRelaunchError || isSwitchError
          const isFallback = relaunchInvalid && fallbackSlot === s.slot

          const className = [
            'slotCard',
            isActive ? 'slotActive' : null,
            isError ? 'slotError' : null,
            isFallback ? 'slotFallback' : null,
            loading ? 'slotDisabled' : null,
          ]
            .filter(Boolean)
            .join(' ')

          const title = s.path ?? undefined
          const name = s.path ? basename(s.path) : 'Unassigned'
          const subtitle = slotSubtitle(s.path)

          const statusBadge = isError
            ? activeStatus === 'missing' || problemKind === 'missing'
              ? 'Missing'
              : 'Unreadable'
            : isFallback
              ? 'Fallback'
              : isActive
                ? 'Active'
                : null

          const statusBadgeClass =
            isError ? 'slotBadge slotBadgeError' : isFallback ? 'slotBadge slotBadgeHint' : 'slotBadge'

          return (
            <div
              key={s.slot}
              className={className}
              role="listitem"
            >
              <button
                type="button"
                className="slotMain"
                disabled={loading}
                onClick={() => void onClickSlot(s.slot, s.path, isActive)}
              >
                <div className="slotNumber">{s.slot}</div>
                <div className="slotBody">
                  <div className="slotNameRow">
                    <div className="slotName">{name}</div>
                    {statusBadge ? <div className={statusBadgeClass}>{statusBadge}</div> : null}
                  </div>
                  <div className="slotPath path" title={title}>
                    {subtitle}
                  </div>
                </div>
              </button>
              {s.path ? (
                <button
                  type="button"
                  className="btn slotUnassign"
                  disabled={loading}
                  onClick={() => void onUnassignSlot(s.slot)}
                >
                  Unassign
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
