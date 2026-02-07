import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Toast } from '../components/Toast'
import { SearchBar } from '../components/SearchBar'
import type { NoteSummary } from '../api/workspace'
import { deleteNote } from '../api/workspace'
import { useWorkspaceStore, workspaceActions } from '../stores/workspaceStore'
import { filterNotes } from '../utils/search'
import { noteColorSlot } from '../utils/noteColor'
import { useNoteRowHeight } from '../hooks/useNoteRowHeight'

type OverviewProps = {
  onManageWorkspaces: () => void
  onOpenNote: (note: NoteSummary, scrollTop: number) => void
  onCreateNote: (note: NoteSummary, scrollTop: number) => void
  restoreScrollTop: number
  restoreFocusStem: string | null
  searchText: string
  onSearchTextChange: (text: string) => void
  includeTags: string[]
  onIncludeTagsChange: (tags: string[]) => void
  excludeTags: string[]
  onExcludeTagsChange: (tags: string[]) => void
  onOpenTodoList: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

function formatNoteTimestamp(note: NoteSummary): string {
  const date = new Date(note.createdAt)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function displayNoteTitle(note: NoteSummary): string {
  const title = note.title?.trim()
  if (title) return title
  return note.filename ?? note.stem
}

export function Overview(props: OverviewProps) {
  const onManageWorkspaces = props.onManageWorkspaces
  const onOpenNote = props.onOpenNote
  const onCreateNote = props.onCreateNote
  const restoreScrollTop = props.restoreScrollTop
  const restoreFocusStem = props.restoreFocusStem
  const searchText = props.searchText
  const onSearchTextChange = props.onSearchTextChange
  const includeTags = props.includeTags
  const onIncludeTagsChange = props.onIncludeTagsChange
  const excludeTags = props.excludeTags
  const onExcludeTagsChange = props.onExcludeTagsChange
  const onOpenTodoList = props.onOpenTodoList

  const slots = useWorkspaceStore((s) => s.slots)
  const activeSlot = useWorkspaceStore((s) => s.activeSlot)
  const activeStatus = useWorkspaceStore((s) => s.activeStatus)
  const loading = useWorkspaceStore((s) => s.loading)
  const notes = useWorkspaceStore((s) => s.notes)

  const listRef = useRef<HTMLUListElement | null>(null)
  const didAutoFocus = useRef(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Filter notes based on search state
  const filteredNotes = useMemo(() => {
    return filterNotes(notes, searchText, includeTags, excludeTags)
  }, [notes, searchText, includeTags, excludeTags])

  const activePath = useMemo(
    () => slots.find((s) => s.slot === activeSlot)?.path ?? null,
    [activeSlot, slots],
  )

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)

  const setNoteRowRef = useNoteRowHeight(focusedIndex)
  const [deleteConfirmStem, setDeleteConfirmStem] = useState<string | null>(null)
  const deleteConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onCloseToast = useCallback(() => setToastMessage(null), [])
  const showToast = useCallback((message: string) => setToastMessage(message), [])

  const scrollTop = useCallback(() => {
    return window.scrollY || document.documentElement.scrollTop || 0
  }, [])

  // Auto-cancel delete confirmation after 4 seconds
  useEffect(() => {
    if (!deleteConfirmStem) return

    deleteConfirmTimerRef.current = setTimeout(() => {
      setDeleteConfirmStem(null)
    }, 4000)

    return () => {
      if (deleteConfirmTimerRef.current) {
        clearTimeout(deleteConfirmTimerRef.current)
      }
    }
  }, [deleteConfirmStem])

  // Cancel delete confirmation on list changes
  useEffect(() => {
    setDeleteConfirmStem(null)
  }, [searchText, includeTags, excludeTags, notes.length])

  const onDeleteNote = useCallback(async (stem: string) => {
    const res = await deleteNote(stem)

    if (res.ok) {
      await workspaceActions.refreshNotes()
      showToast('Note deleted')
    } else {
      showToast(res.error?.message ?? 'Failed to delete note')
      await workspaceActions.refreshNotes()
    }

    setDeleteConfirmStem(null)
  }, [showToast])

  const onNewNote = useCallback(() => {
    void (async () => {
      const currentScrollTop = scrollTop()
      const res = await workspaceActions.createNote()
      if (res.ok) {
        showToast('New note created')
        onCreateNote(res.note, currentScrollTop)
        return
      }

      showToast(res.message ?? 'Failed to create note')
    })()
  }, [onCreateNote, scrollTop, showToast])

  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(index, filteredNotes.length)),
    [filteredNotes.length],
  )

  const openFocused = useCallback(() => {
    if (focusedIndex === 0) {
      onNewNote()
      return
    }

    const note = filteredNotes[focusedIndex - 1]
    if (!note) return
    onOpenNote(note, scrollTop())
  }, [focusedIndex, filteredNotes, onNewNote, onOpenNote, scrollTop])

  useEffect(() => {
    if (activeStatus !== 'ok') return
    void workspaceActions.refreshNotes()
  }, [activeSlot, activeStatus])

  useEffect(() => {
    if (!filteredNotes.length && restoreFocusStem) {
      setFocusedIndex(0)
      return
    }

    if (restoreFocusStem) {
      const idx = filteredNotes.findIndex((note) => note.stem === restoreFocusStem)
      if (idx >= 0) {
        setFocusedIndex(idx + 1)
        return
      }
    }

    setFocusedIndex((prev) => clampIndex(prev))
  }, [clampIndex, filteredNotes, restoreFocusStem])

  useEffect(() => {
    if (restoreScrollTop <= 0) return
    window.scrollTo({ top: restoreScrollTop })
  }, [restoreScrollTop])

  useEffect(() => {
    if (didAutoFocus.current) return
    const list = listRef.current
    if (!list) return
    if (document.activeElement && document.activeElement !== document.body) return
    list.focus()
    didAutoFocus.current = true
  }, [notes.length])

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

  // Cmd+F shortcut to focus search input
  useEffect(() => {
    const handleCmdF = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleCmdF)
    return () => window.removeEventListener('keydown', handleCmdF)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      // Any key other than 'd' cancels delete confirmation
      if (deleteConfirmStem && event.key !== 'd' && event.key !== 'D') {
        setDeleteConfirmStem(null)
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedIndex((prev) => clampIndex(prev + 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedIndex((prev) => clampIndex(prev - 1))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        openFocused()
        return
      }

      if (event.key === 'T' || event.key === 't') {
        event.preventDefault()
        onOpenTodoList()
        return
      }

      if (event.key === 'W' || event.key === 'w') {
        event.preventDefault()
        onManageWorkspaces()
        return
      }

      if (event.key === 'N' || event.key === 'n') {
        event.preventDefault()
        onNewNote()
        return
      }

      if (event.key === 'd' || event.key === 'D') {
        event.preventDefault()

        // Can't delete from "New Note" row
        if (focusedIndex === 0) return

        const note = filteredNotes[focusedIndex - 1]
        if (!note) return

        // First press: enter confirmation state
        if (deleteConfirmStem !== note.stem) {
          setDeleteConfirmStem(note.stem)
          return
        }

        // Second press: execute delete
        void onDeleteNote(note.stem)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clampIndex, openFocused, onOpenTodoList, onManageWorkspaces, onNewNote, focusedIndex, filteredNotes, deleteConfirmStem, onDeleteNote])

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
        <div>
          <div className="notesTitle">Notes</div>
          <div className="notesMeta">Root-level *.md only</div>
        </div>
      </div>

      <SearchBar
        searchText={searchText}
        onSearchTextChange={onSearchTextChange}
        includeTags={includeTags}
        onIncludeTagsChange={onIncludeTagsChange}
        excludeTags={excludeTags}
        onExcludeTagsChange={onExcludeTagsChange}
        placeholder="Search"
        inputRef={searchInputRef}
      />

      {loading ? (
        <div className="mutedBlock">Loading…</div>
      ) : notes.length ? (
        <>
          <ul className="notesList" ref={listRef} tabIndex={0}>
            <li
              key="new-note"
              ref={(el) => setNoteRowRef(0, el)}
              className={`noteRow noteRowInteractive noteRowNew${
                focusedIndex === 0 ? ' noteRowFocused' : ''
              }`}
              onClick={() => setFocusedIndex(0)}
              onDoubleClick={onNewNote}
            >
              <div className="noteRowMain">
                <div className="noteName">New Note</div>
                <div className="noteTimestamp">Enter to create</div>
              </div>
            </li>
            {filteredNotes.map((note, idx) => {
            const rowIndex = idx + 1
            const isFocused = rowIndex === focusedIndex
            const isDeleteWarning = note.stem === deleteConfirmStem
            return (
              <li
                key={note.stem}
                ref={(el) => setNoteRowRef(rowIndex, el)}
                className={`noteRow noteRowInteractive${isFocused ? ' noteRowFocused' : ''}${isDeleteWarning ? ' noteRowDeleteWarning' : ''}`}
                style={{ '--note-bg': `var(--color-slot-${noteColorSlot(note.stem)})` } as React.CSSProperties}
                onClick={() => {
                  setFocusedIndex(rowIndex)
                  setDeleteConfirmStem(null)
                }}
                onDoubleClick={() => onOpenNote(note, scrollTop())}
              >
                <div className="noteRowMain">
                  <div className="noteName">{isDeleteWarning ? 'Press d again to delete' : displayNoteTitle(note)}</div>
                  <div className="noteTimestamp">{formatNoteTimestamp(note)}</div>
                </div>
                {note.tags && note.tags.length > 0 && (
                  <div className="noteTags">
                    {[...note.tags].sort().map((tag) => (
                      <span
                        key={tag}
                        className="noteTag"
                        onClick={(e) => {
                          e.stopPropagation() // Don't trigger row click
                          if (e.metaKey || e.ctrlKey) {
                            // Exclude tag
                            onExcludeTagsChange(excludeTags.includes(tag) ? excludeTags : [...excludeTags, tag])
                          } else {
                            // Include tag
                            onIncludeTagsChange(includeTags.includes(tag) ? includeTags : [...includeTags, tag])
                          }
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
          </ul>
          {filteredNotes.length === 0 && notes.length > 0 && (
            <div className="mutedBlock"></div>
          )}
        </>
      ) : (
        <ul className="notesList" ref={listRef} tabIndex={0}>
          <li
            key="new-note"
            ref={(el) => setNoteRowRef(0, el)}
            className={`noteRow noteRowInteractive noteRowNew${
              focusedIndex === 0 ? ' noteRowFocused' : ''
            }`}
            onClick={() => setFocusedIndex(0)}
            onDoubleClick={onNewNote}
          >
            <div className="noteRowMain">
              <div className="noteName">New Note</div>
              <div className="noteTimestamp">Enter to create</div>
            </div>
          </li>
          <li className="mutedBlock">No notes found in the workspace root.</li>
        </ul>
      )}

      {toastMessage ? <Toast message={toastMessage} onClose={onCloseToast} /> : null}
    </section>
  )
}
