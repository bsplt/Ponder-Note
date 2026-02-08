import { useCallback, useEffect, useMemo } from 'react'
import { confirmReplace, pickDirectory } from '../api/tauri'
import { useWorkspaceStore, workspaceActions } from '../stores/workspaceStore'

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const last = parts[parts.length - 1]
  return last.length ? last : path
}

function slotSubtitle(path: string | null): string {
  return path ?? '(no folder)'
}

type WorkspacesProps = {
  onGoToOverview: () => void
}

export function Workspaces({ onGoToOverview }: WorkspacesProps) {
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

  const onClickSlot = useCallback(
    async (slot: number, existingPath: string | null) => {
      if (loading) return

      if (existingPath) {
        const ok = await confirmReplace(`Replace the folder assigned to slot ${slot}?`)
        if (!ok) return
      }

      await onPickAndAssign(slot)
    },
    [loading, onPickAndAssign],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'O' || e.key === 'o') {
        e.preventDefault()
        onGoToOverview()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onGoToOverview])

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
        <p className="panelSubtitle">Pick a slot to assign or replace its workspace folder.</p>
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
            'slot',
            isActive ? 'slotActive' : null,
            isError ? 'slotError' : null,
            isFallback ? 'slotFallback' : null,
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
            <button
              key={s.slot}
              type="button"
              className={className}
              role="listitem"
              disabled={loading}
              onClick={() => void onClickSlot(s.slot, s.path)}
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
          )
        })}
      </div>
    </section>
  )
}
