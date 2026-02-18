import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { NoteApiError, noteDiscard, noteRead, noteSave } from '../api/notes'
import { toggleTodo } from '../api/todos'
import { workspaceActions, useWorkspaceStore } from '../stores/workspaceStore'
import { PillInput } from '../components/PillInput'
import { Toast } from '../components/Toast'
import { TodoRow } from '../components/TodoRow'
import { workspaceUpdateNoteTags, workspaceGetAllTags } from '../api/workspace'
import { extractMarkdownTodos, normalizePreviewTodoLines, toggleMarkdownTodoInBody, type MarkdownTodo } from '../utils/markdownTodo'
import { noteColorSlot } from '../utils/noteColor'
import { isTypingTarget } from '../utils/keyboard'

type EditorProps = {
  stem: string
  isNew: boolean
  onExit: (result: { stem: string; discarded: boolean }) => void
}

type EditorMode = 'preview' | 'edit'

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

function defaultEditorMode(isNew: boolean): EditorMode {
  return isNew ? 'edit' : 'preview'
}

function todoToggleKey(todo: MarkdownTodo): string {
  return `${todo.lineNumber}:${todo.charOffset}`
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
  const pendingPreviewToggleKeysRef = useRef(new Set<string>())
  const previewTodoRowRefsRef = useRef(new Map<string, HTMLDivElement>())
  const restorePreviewFocusKeyRef = useRef<string | null>(null)

  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [workspaceTags, setWorkspaceTags] = useState<string[]>([])
  const [tagSaveError, setTagSaveError] = useState<string | null>(null)
  const [mode, setMode] = useState<EditorMode>(() => defaultEditorMode(isNew))
  const [previewToastMessage, setPreviewToastMessage] = useState<string | null>(null)
  const [previewToggleVersion, setPreviewToggleVersion] = useState(0)

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const availableContainerHeight = textarea.parentElement?.clientHeight ?? 0
    const nextHeight = Math.max(textarea.scrollHeight, availableContainerHeight)
    textarea.style.height = `${nextHeight}px`
  }, [])

  useEffect(() => {
    bodyRef.current = body
  }, [body])

  useLayoutEffect(() => {
    if (mode !== 'edit') return
    syncTextareaHeight()
  }, [body, mode, syncTextareaHeight])

  useEffect(() => {
    saveErrorRef.current = saveError
  }, [saveError])

  useEffect(() => {
    setMode(defaultEditorMode(isNew))
  }, [isNew, stem])

  useEffect(() => {
    pendingPreviewToggleKeysRef.current.clear()
    previewTodoRowRefsRef.current.clear()
    restorePreviewFocusKeyRef.current = null
    setPreviewToggleVersion((v) => v + 1)
    setPreviewToastMessage(null)
  }, [stem])

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
    } catch (err) {
      setLoading(false)
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load note')
    }
  }, [isNew, notes, stem])

  useEffect(() => {
    void loadNote()
  }, [loadNote])

  useEffect(() => {
    if (loading || errorMessage || mode !== 'edit') return

    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      syncTextareaHeight()
      textarea.focus()

      const pos = cursorStartPosition(bodyRef.current, isNew)
      textarea.setSelectionRange(pos, pos)
    })
  }, [errorMessage, isNew, loading, mode, syncTextareaHeight, stem])

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
      if (mode !== 'edit') return
      syncTextareaHeight()
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode, syncTextareaHeight])

  const saveStatus = useMemo(() => formatTime(lastSavedAt), [lastSavedAt])
  const previewTodosByLine = useMemo(() => extractMarkdownTodos(body), [body])
  const previewBody = useMemo(() => normalizePreviewTodoLines(body), [body])
  const previewTodoKeysOrdered = useMemo(() => {
    return Array.from(previewTodosByLine.values())
      .sort((a, b) => {
        if (a.lineNumber === b.lineNumber) return a.charOffset - b.charOffset
        return a.lineNumber - b.lineNumber
      })
      .map((todo) => todoToggleKey(todo))
  }, [previewTodosByLine])

  const previewTodoIndexByKey = useMemo(() => {
    const map = new Map<string, number>()
    previewTodoKeysOrdered.forEach((key, index) => {
      map.set(key, index)
    })
    return map
  }, [previewTodoKeysOrdered])

  const focusPreviewNeighborTodo = useCallback(
    (currentIndex: number, direction: -1 | 1) => {
      let index = currentIndex + direction

      while (index >= 0 && index < previewTodoKeysOrdered.length) {
        const key = previewTodoKeysOrdered[index]
        if (!pendingPreviewToggleKeysRef.current.has(key)) {
          const element = previewTodoRowRefsRef.current.get(key)
          element?.focus()
          return
        }
        index += direction
      }
    },
    [previewTodoKeysOrdered],
  )

  const handlePreviewTodoToggle = useCallback(
    async (todo: MarkdownTodo, options: { preserveFocus?: boolean } = {}) => {
      const preserveFocus = options.preserveFocus ?? false
      const key = todoToggleKey(todo)
      if (pendingPreviewToggleKeysRef.current.has(key)) {
        return
      }

      pendingPreviewToggleKeysRef.current.add(key)
      setPreviewToggleVersion((v) => v + 1)

      let nextBody: string
      try {
        nextBody = toggleMarkdownTodoInBody(bodyRef.current, todo.lineNumber, todo.charOffset).body
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setPreviewToastMessage(`Failed to toggle todo: ${message}`)
        pendingPreviewToggleKeysRef.current.delete(key)
        setPreviewToggleVersion((v) => v + 1)
        return
      }

      setBody(nextBody)
      bodyRef.current = nextBody
      lastSavedBodyRef.current = nextBody
      setSaveError(null)

      try {
        await toggleTodo(stem, todo.lineNumber, todo.charOffset)
        setLastSavedAt(Date.now())
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        try {
          const reloadedBody = await noteRead(stem)
          setBody(reloadedBody)
          bodyRef.current = reloadedBody
          lastSavedBodyRef.current = reloadedBody
          setPreviewToastMessage(`Failed to toggle todo: ${message}. Note was reloaded.`)
        } catch (reloadErr) {
          const reloadMessage = reloadErr instanceof Error ? reloadErr.message : String(reloadErr)
          setPreviewToastMessage(`Failed to toggle todo: ${message}. Reload failed: ${reloadMessage}`)
        }
      } finally {
        if (preserveFocus) {
          restorePreviewFocusKeyRef.current = key
        }
        pendingPreviewToggleKeysRef.current.delete(key)
        setPreviewToggleVersion((v) => v + 1)
      }
    },
    [stem],
  )

  useEffect(() => {
    if (mode !== 'preview') return
    const key = restorePreviewFocusKeyRef.current
    if (!key) return

    const id = window.requestAnimationFrame(() => {
      const element = previewTodoRowRefsRef.current.get(key)
      if (element) {
        element.focus()
      }
      restorePreviewFocusKeyRef.current = null
    })

    return () => window.cancelAnimationFrame(id)
  }, [mode, previewToggleVersion])

  const markdownComponents = useMemo<Components>(
    () => ({
      li: ({ node, children, className, ...props }) => {
        const startLine = node?.position?.start?.line
        const todo = typeof startLine === 'number' ? previewTodosByLine.get(startLine - 1) : undefined
        if (!todo) {
          return (
            <li className={className} {...props}>
              {children}
            </li>
          )
        }

        const todoKey = todoToggleKey(todo)
        const pending = pendingPreviewToggleKeysRef.current.has(todoKey)
        const mergedClassName = className ? `editorTodoItem ${className}` : 'editorTodoItem'
        const todoIndex = previewTodoIndexByKey.get(todoKey) ?? -1

        return (
          <li className={mergedClassName} {...props}>
            <TodoRow
              checked={todo.checked}
              text={todo.text}
              onToggle={() => {
                void handlePreviewTodoToggle(todo)
              }}
              disabled={pending}
              className="editorTodoRow"
              role="checkbox"
              ariaLabel={todo.text}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (!pending) {
                    void handlePreviewTodoToggle(todo, { preserveFocus: true })
                  }
                  return
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  if (todoIndex >= 0) {
                    focusPreviewNeighborTodo(todoIndex, 1)
                  }
                  return
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  if (todoIndex >= 0) {
                    focusPreviewNeighborTodo(todoIndex, -1)
                  }
                }
              }}
              containerRef={(element) => {
                if (!element) {
                  previewTodoRowRefsRef.current.delete(todoKey)
                  return
                }
                previewTodoRowRefsRef.current.set(todoKey, element)
              }}
            />
          </li>
        )
      },
    }),
    [focusPreviewNeighborTodo, handlePreviewTodoToggle, previewTodoIndexByKey, previewToggleVersion, previewTodosByLine],
  )

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

    if (mode === 'preview') {
      await workspaceActions.refreshNotes()
      onExit({ stem, discarded: false })
      return
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
  }, [isExiting, isNew, mode, onExit, performSave, stem])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        mode === 'preview' &&
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target) &&
        (event.key === 'e' || event.key === 'E')
      ) {
        event.preventDefault()
        setMode('edit')
        return
      }

      if (event.key !== 'Escape') return
      event.preventDefault()
      void handleExit()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleExit, mode])

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
    <section className="panel editorPanel" style={{ '--note-bg': `var(--color-slot-${noteColorSlot(stem)})` } as CSSProperties}>
      <div className="editorHeader">
        <div>
          <h2 className="panelTitle">{mode === 'edit' ? 'Editing note' : 'Viewing note'}</h2>
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
        <div className="editorModeHint">{mode === 'preview' ? 'Press E to edit' : 'Editing mode'}</div>
      </div>

      <div className="editorBody">
        <div className="editorContent">
          {mode === 'edit' ? (
            <textarea
              ref={textareaRef}
              className="editorTextarea"
              value={body}
              onChange={handleChange}
              spellCheck={false}
            />
          ) : (
            <div className="editorMarkdown">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
                {previewBody}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      <div className="editorFooter">
        <span>ESC to exit</span>
        <span>Autosave is on</span>
      </div>

      {previewToastMessage ? (
        <Toast message={previewToastMessage} onClose={() => setPreviewToastMessage(null)} />
      ) : null}
    </section>
  )
}
