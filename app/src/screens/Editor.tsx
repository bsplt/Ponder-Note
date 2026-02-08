import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { NoteApiError, noteDiscard, noteRead, noteSave } from '../api/notes'
import { workspaceActions, useWorkspaceStore } from '../stores/workspaceStore'
import { PillInput } from '../components/PillInput'
import { workspaceUpdateNoteTags, workspaceGetAllTags } from '../api/workspace'
import { noteColorSlot } from '../utils/noteColor'

type EditorProps = {
  stem: string
  isNew: boolean
  onExit: (result: { stem: string; discarded: boolean }) => void
}

const AUTO_SAVE_DELAY_MS = 500
const AUTO_RETRY_DELAY_MS = 4500

function formatTime(value: number | null): string {
  if (!value) return 'Not saved yet'
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function isUntouchedNewNote(body: string): boolean {
  const normalized = body.replace(/\r\n/g, '\n')
  const trimmed = normalized.replace(/\n+$/g, '')
  return trimmed === '# ' || trimmed === '#'
}

function cursorStartPosition(body: string, isNew: boolean): number {
  if (!isNew) return 0
  if (body.startsWith('# ')) return 2
  if (body.startsWith('#')) return 1
  return 0
}

export function Editor(props: EditorProps) {
  const { stem, isNew, onExit } = props
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const notes = useWorkspaceStore((s) => s.notes)
  const saveTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const pendingSaveRef = useRef(false)
  const lastSavedBodyRef = useRef('')
  const bodyRef = useRef('')
  const saveErrorRef = useRef<string | null>(null)

  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [workspaceTags, setWorkspaceTags] = useState<string[]>([])
  const [tagSaveError, setTagSaveError] = useState<string | null>(null)

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const minHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 0
    const nextHeight = Math.max(textarea.scrollHeight, minHeight)
    textarea.style.height = `${nextHeight}px`
  }, [])

  useEffect(() => {
    bodyRef.current = body
  }, [body])

  useLayoutEffect(() => {
    syncTextareaHeight()
  }, [body, syncTextareaHeight])

  useEffect(() => {
    saveErrorRef.current = saveError
  }, [saveError])

  // Load workspace tags on mount
  useEffect(() => {
    void (async () => {
      try {
        const allTags = await workspaceGetAllTags()
        setWorkspaceTags(allTags)
      } catch (err) {
        // Silent fail - autocomplete just won't work
        console.error('Failed to load workspace tags:', err)
      }
    })()
  }, [])

  const loadNote = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const result = await noteRead(stem)
      const initialBody = isNew && result.trim() === '' ? '# ' : result
      setBody(initialBody)
      lastSavedBodyRef.current = initialBody
      bodyRef.current = initialBody
      
      // Load note tags from workspace notes list
      const note = notes.find((n) => n.stem === stem)
      setTags(note?.tags || [])
      
      setLoading(false)
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (!textarea) return
        syncTextareaHeight()
        textarea.focus()
        const pos = cursorStartPosition(initialBody, isNew)
        textarea.setSelectionRange(pos, pos)
      })
    } catch (err) {
      setLoading(false)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load note')
    }
  }, [isNew, notes, stem, syncTextareaHeight])

  useEffect(() => {
    void loadNote()
  }, [loadNote])

  const performSave = useCallback(
    async (options: { force?: boolean; rewriteOnExit?: boolean } = {}) => {
      const force = options.force ?? false
      const rewriteOnExit = options.rewriteOnExit ?? false
      const currentBody = bodyRef.current
      if (!force && !rewriteOnExit) {
        if (currentBody === lastSavedBodyRef.current && !saveErrorRef.current) {
          return true
        }
      }

      if (saveInFlightRef.current) {
        pendingSaveRef.current = true
        return saveInFlightRef.current
      }

      const promise = (async () => {
        try {
          await noteSave({ stem, body: currentBody, rewriteOnExit })
          lastSavedBodyRef.current = currentBody
          setLastSavedAt(Date.now())
          setSaveError(null)
          return true
        } catch (err) {
          const message =
            err instanceof NoteApiError
              ? `${err.code}: ${err.message}`
              : err instanceof Error
                ? err.message
                : 'Save failed'
          console.error('[ponder][note_save] failed', {
            stem,
            rewriteOnExit,
            bytes: currentBody.length,
            error: err,
          })
          setSaveError(message)
          return false
        }
      })()

      saveInFlightRef.current = promise
      const result = await promise
      saveInFlightRef.current = null

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        void performSave({ force: true })
      }

      return result
    },
    [stem],
  )

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      void performSave()
    }, AUTO_SAVE_DELAY_MS)
  }, [performSave])

  useEffect(() => {
    if (!saveError) return
    const id = window.setInterval(() => {
      if (saveInFlightRef.current) return
      void performSave({ force: true })
    }, AUTO_RETRY_DELAY_MS)
    return () => window.clearInterval(id)
  }, [performSave, saveError])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      syncTextareaHeight()
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [syncTextareaHeight])

  const saveStatus = useMemo(() => formatTime(lastSavedAt), [lastSavedAt])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      setBody(next)
      bodyRef.current = next
      scheduleSave()
    },
    [scheduleSave],
  )

  const handleExit = useCallback(async () => {
    if (isExiting) return
    setIsExiting(true)

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const currentBody = bodyRef.current
    if (isNew && isUntouchedNewNote(currentBody)) {
      try {
        await noteDiscard(stem)
        await workspaceActions.refreshNotes()
        onExit({ stem, discarded: true })
        return
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to discard note')
        setIsExiting(false)
        return
      }
    }

    if (saveInFlightRef.current) {
      await saveInFlightRef.current
    }

    const ok = await performSave({ force: true, rewriteOnExit: true })
    if (!ok) {
      const confirmExit = window.confirm(
        'Latest save failed. Exit anyway? Unsaved changes may be lost.',
      )
      if (!confirmExit) {
        setIsExiting(false)
        return
      }
    }

    await workspaceActions.refreshNotes()
    onExit({ stem, discarded: false })
  }, [isExiting, isNew, onExit, performSave, stem])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      void handleExit()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleExit])

  const handleRetrySave = useCallback(() => {
    void performSave({ force: true })
  }, [performSave])

  const handleTagBlur = useCallback(() => {
    void (async () => {
      if (!stem) return
      try {
        await workspaceUpdateNoteTags(stem, tags)
        setTagSaveError(null)
        // Note: refreshNotes() is called on editor exit, so tags will appear in overview then
      } catch (err) {
        setTagSaveError('Failed to save tags')
        console.error('Tag save error:', err)
      }
    })()
  }, [stem, tags])

  if (loading) {
    return (
      <section className="panel">
        <h2 className="panelTitle">Loading note…</h2>
        <p className="panelSubtitle">Opening {stem}</p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="panel">
        <h2 className="panelTitle">Could not open note</h2>
        <p className="panelSubtitle">{errorMessage}</p>
        <div className="panelActions">
          <button type="button" className="btn" onClick={handleExit}>
            Back to overview
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel editorPanel" style={{ '--note-bg': `var(--color-slot-${noteColorSlot(stem)})` } as React.CSSProperties}>
      <div className="editorHeader">
        <div>
          <h2 className="panelTitle">Editing note</h2>
          <div className="editorMeta">Last saved: {saveStatus}</div>
        </div>
        <button type="button" className="btn" onClick={handleExit} disabled={isExiting}>
          Back to overview
        </button>
      </div>

      {saveError ? (
        <div className="editorBanner" role="status">
          <div className="editorBannerMessage">
            Autosave failed: {saveError}. Last saved: {saveStatus}
          </div>
          <button type="button" className="btn btnPrimary" onClick={handleRetrySave}>
            Retry save
          </button>
        </div>
      ) : null}

      <div className="editorTagSection">
        <PillInput
          values={tags}
          onChange={setTags}
          onBlur={handleTagBlur}
          suggestions={workspaceTags}
          placeholder="Tags"
        />
        {tagSaveError && <div className="editorTagError">{tagSaveError}</div>}
      </div>

      <div className="editorBody">
        <div className="editorContent">
          <textarea
            ref={textareaRef}
            className="editorTextarea"
            value={body}
            onChange={handleChange}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="editorFooter">
        <span>ESC to exit</span>
        <span>Autosave is on</span>
      </div>
    </section>
  )
}
