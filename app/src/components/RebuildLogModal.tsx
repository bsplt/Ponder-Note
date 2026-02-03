import { useEffect, useMemo, useState } from 'react'
import { openPath } from '@tauri-apps/plugin-opener'
import { type RebuildLog, workspaceGetRebuildLog, workspaceGetState } from '../api/workspace'

type RebuildLogModalProps = {
  isOpen: boolean
  onClose: () => void
}

function formatTimestamp(value: number): string {
  if (!Number.isFinite(value)) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}

function formatDuration(startedAt: number, finishedAt: number): string {
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return 'Unknown'
  const durationMs = Math.max(0, finishedAt - startedAt)
  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

export function RebuildLogModal({ isOpen, onClose }: RebuildLogModalProps) {
  const [log, setLog] = useState<RebuildLog | null>(null)
  const [logPath, setLogPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setOpenError(null)

      try {
        const [logResult, state] = await Promise.all([
          workspaceGetRebuildLog(),
          workspaceGetState(),
        ])

        if (cancelled) return

        const activeSlot = state.slots.find((slot) => slot.slot === state.activeSlot)
        const activePath = activeSlot?.path ?? null

        setLog(logResult)
        setLogPath(activePath ? `${activePath}/.ponder/rebuild-log.json` : null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load rebuild log')
        setLog(null)
        setLogPath(null)
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const summary = useMemo(() => {
    if (!log) return null
    return {
      startedAt: formatTimestamp(log.startedAt),
      finishedAt: formatTimestamp(log.finishedAt),
      duration: formatDuration(log.startedAt, log.finishedAt),
      notesScanned: log.counts.notesScanned,
      sidecarsCreated: log.counts.sidecarsCreated,
      sidecarsRepaired: log.counts.sidecarsRepaired,
      errorCount: log.errors.length,
    }
  }, [log])

  const handleOpenLog = async () => {
    if (!logPath) return
    setOpenError(null)
    try {
      await openPath(logPath)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'Failed to open log file')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="modalOverlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modalCard" role="dialog" aria-modal="true" aria-label="Rebuild log">
        <div className="modalHeader">
          <div>
            <h2 className="modalTitle">Rebuild log</h2>
            <div className="modalSubtitle">Latest rebuild summary</div>
          </div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modalBody">
          {loading ? <div className="modalMuted">Loading rebuild log…</div> : null}
          {error ? <div className="modalError">{error}</div> : null}

          {!loading && !error && !log ? (
            <div className="modalEmpty">No rebuild log found yet.</div>
          ) : null}

          {!loading && !error && summary ? (
            <div className="modalSection">
              <div className="modalRow">
                <div className="modalLabel">Started</div>
                <div className="modalValue">{summary.startedAt}</div>
              </div>
              <div className="modalRow">
                <div className="modalLabel">Finished</div>
                <div className="modalValue">{summary.finishedAt}</div>
              </div>
              <div className="modalRow">
                <div className="modalLabel">Duration</div>
                <div className="modalValue">{summary.duration}</div>
              </div>
              <div className="modalDivider" />
              <div className="modalRow">
                <div className="modalLabel">Notes scanned</div>
                <div className="modalValue">{summary.notesScanned}</div>
              </div>
              <div className="modalRow">
                <div className="modalLabel">Sidecars created</div>
                <div className="modalValue">{summary.sidecarsCreated}</div>
              </div>
              <div className="modalRow">
                <div className="modalLabel">Sidecars repaired</div>
                <div className="modalValue">{summary.sidecarsRepaired}</div>
              </div>
              <div className="modalRow">
                <div className="modalLabel">Errors</div>
                <div className="modalValue">{summary.errorCount}</div>
              </div>
            </div>
          ) : null}

          {!loading && !error && log && log.errors.length > 0 ? (
            <div className="modalSection">
              <div className="modalSectionTitle">Errors</div>
              <div className="modalErrorList">
                {log.errors.map((err, index) => (
                  <div key={`${err.message}-${index}`} className="modalErrorItem">
                    <div className="modalErrorMessage">{err.message}</div>
                    {err.noteStem ? (
                      <div className="modalErrorMeta">Note: {err.noteStem}</div>
                    ) : null}
                    {err.path ? <div className="modalErrorMeta">Path: {err.path}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {openError ? <div className="modalError">{openError}</div> : null}
        </div>

        <div className="modalActions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btnPrimary" onClick={handleOpenLog} disabled={!logPath}>
            Open log file
          </button>
        </div>
      </div>
    </div>
  )
}
