import { useCallback, useEffect, useMemo, useState } from 'react'
import { Toast } from '../components/Toast'
import { useWorkspaceStore, workspaceActions } from '../stores/workspaceStore'

type OverviewProps = {
  onManageWorkspaces: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export function Overview(props: OverviewProps) {
  const onManageWorkspaces = props.onManageWorkspaces

  const slots = useWorkspaceStore((s) => s.slots)
  const activeSlot = useWorkspaceStore((s) => s.activeSlot)
  const activeStatus = useWorkspaceStore((s) => s.activeStatus)
  const loading = useWorkspaceStore((s) => s.loading)
  const rootNotes = useWorkspaceStore((s) => s.rootNotes)

  const activePath = useMemo(
    () => slots.find((s) => s.slot === activeSlot)?.path ?? null,
    [activeSlot, slots],
  )

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const onCloseToast = useCallback(() => setToastMessage(null), [])
  const showToast = useCallback((message: string) => setToastMessage(message), [])

  useEffect(() => {
    if (activeStatus !== 'ok') return
    void workspaceActions.refreshNotes()
  }, [activeSlot, activeStatus])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > 9) return

      e.preventDefault()

      if (activeStatus !== 'ok') {
        onManageWorkspaces()
        return
      }

      if (n === activeSlot) return

      void (async () => {
        const res = await workspaceActions.switchSlot(n)
        if (res.ok) {
          showToast(`Switched to workspace ${n}`)
          return
        }

        if (res.code === 'unassigned_slot') {
          onManageWorkspaces()
          return
        }

        if (res.code === 'workspace_missing' || res.code === 'workspace_unreadable') {
          onManageWorkspaces()
        }
      })()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeSlot, activeStatus, onManageWorkspaces, showToast])

  if (activeStatus !== 'ok' || !activePath) {
    const title =
      activeStatus === 'missing'
        ? 'Workspace folder is missing'
        : activeStatus === 'unreadable'
          ? 'Workspace folder is unreadable'
          : 'No workspace selected yet'

    const subtitle =
      activeStatus === 'missing' || activeStatus === 'unreadable'
        ? 'Open Workspaces to reassign the active slot.'
        : 'Assign a folder to a slot to get started.'

    return (
      <section className="panel">
        <h2 className="panelTitle">{title}</h2>
        <p className="panelSubtitle">{subtitle}</p>

        <div className="panelActions">
          <button type="button" className="btn btnPrimary" onClick={onManageWorkspaces}>
            Manage workspaces
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="overviewHeader">
        <div>
          <h2 className="panelTitle">Workspace {activeSlot}</h2>
          <div className="path overviewPath" title={activePath}>
            {activePath}
          </div>
        </div>

        <div className="panelActions panelActionsInline">
          <button type="button" className="btn" onClick={onManageWorkspaces}>
            Workspaces
          </button>
        </div>
      </div>

      <div className="notesHeader">
        <div className="notesTitle">Notes</div>
        <div className="notesMeta">Root-level *.md only</div>
      </div>

      {loading ? (
        <div className="mutedBlock">Loading…</div>
      ) : rootNotes.length ? (
        <ul className="notesList">
          {rootNotes.map((n) => (
            <li key={n} className="noteRow">
              <div className="noteName">{n}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mutedBlock">No notes found in the workspace root.</div>
      )}

      {toastMessage ? <Toast message={toastMessage} onClose={onCloseToast} /> : null}
    </section>
  )
}
