import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Overview } from './screens/Overview'
import { Editor } from './screens/Editor'
import { Workspaces } from './screens/Workspaces'
import { TodoList } from './screens/TodoList'
import { Shortcuts } from './screens/Shortcuts'
import type { NoteSummary } from './api/workspace'
import { RebuildLogModal } from './components/RebuildLogModal'
import { useWorkspaceStore, workspaceActions } from './stores/workspaceStore'
import { applyEditorChrome, resetEditorChrome } from './utils/editorChrome'
import { getGlobalNavAction, isTypingTarget, type AppScreen } from './utils/keyboard'
import { noteColorSlot } from './utils/noteColor'
import { restoreAppInputFocus } from './utils/windowFocus'
import './styles.css'

function titleForScreen(screen: AppScreen): string {
  if (screen === 'overview') return 'Overview'
  if (screen === 'editor') return 'Editor'
  if (screen === 'todolist') return 'Todos'
  if (screen === 'shortcuts') return 'Shortcuts'
  return 'Workspaces'
}

function App() {
  const isMac =
    typeof navigator !== 'undefined' &&
    (/mac/i.test(navigator.platform ?? '') || /macintosh|mac os x/i.test(navigator.userAgent ?? ''))

  const [screen, setScreen] = useState<AppScreen>('overview')
  const [activeNoteStem, setActiveNoteStem] = useState<string | null>(null)
  const [activeNoteIsNew, setActiveNoteIsNew] = useState(false)
  const [overviewScrollTop, setOverviewScrollTop] = useState(0)
  const [overviewFocusStem, setOverviewFocusStem] = useState<string | null>(null)
  const [overviewCompact, setOverviewCompact] = useState(false)
  const [rebuildLogOpen, setRebuildLogOpen] = useState(false)
  const appMainRef = useRef<HTMLElement | null>(null)
  const previousScreenRef = useRef<AppScreen>('overview')
  const previousEditorStemRef = useRef<string | null>(null)

  // Search state (persists when navigating to editor and back)
  const [searchText, setSearchText] = useState('')
  const [includeTags, setIncludeTags] = useState<string[]>([])
  const [excludeTags, setExcludeTags] = useState<string[]>([])

  const didBoot = useRef(false)
  const title = useMemo(() => titleForScreen(screen), [screen])

  const loading = useWorkspaceStore((s) => s.loading)
  const activeStatus = useWorkspaceStore((s) => s.activeStatus)
  const notes = useWorkspaceStore((s) => s.notes)

  useEffect(() => {
    void workspaceActions.boot()
  }, [])

  useEffect(() => {
    if (loading) return

    if (!didBoot.current) {
      didBoot.current = true
      // On first boot: start on overview if a workspace is configured (even
      // if its status is temporarily non-ok, e.g. during note loading).
      // Only go to workspaces if no workspace has been assigned at all.
      if (activeStatus === 'unassigned') {
        setScreen('workspaces')
      }
      return
    }

    if (activeStatus !== 'ok' && screen !== 'editor') {
      setScreen('workspaces')
    }
  }, [activeStatus, loading, screen])

  useEffect(() => {
    if (screen === 'editor') {
      setRebuildLogOpen(false)
    }
  }, [screen])

  useEffect(() => {
    const previousScreen = previousScreenRef.current
    const previousEditorStem = previousEditorStemRef.current

    const enteringEditor = previousScreen !== 'editor' && screen === 'editor'
    const leavingEditor = previousScreen === 'editor' && screen !== 'editor'
    const switchingEditorNote =
      previousScreen === 'editor' &&
      screen === 'editor' &&
      activeNoteStem !== null &&
      activeNoteStem !== previousEditorStem

    if ((enteringEditor || switchingEditorNote) && activeNoteStem) {
      void applyEditorChrome(noteColorSlot(activeNoteStem))
    }

    if (leavingEditor) {
      void resetEditorChrome()
    }

    previousScreenRef.current = screen
    previousEditorStemRef.current = activeNoteStem
  }, [activeNoteStem, screen])

  useEffect(() => {
    return () => {
      void resetEditorChrome()
    }
  }, [])

  const openEditor = useCallback(
    (note: NoteSummary, isNew: boolean, scrollTop: number) => {
      setActiveNoteStem(note.stem)
      setActiveNoteIsNew(isNew)
      setOverviewScrollTop(scrollTop)
      setOverviewFocusStem(note.stem)
      setScreen('editor')
    },
    [],
  )

  const handleOpenNote = useCallback(
    (note: NoteSummary, scrollTop: number) => {
      openEditor(note, false, scrollTop)
    },
    [openEditor],
  )

  const handleCreateNote = useCallback(
    (note: NoteSummary, scrollTop: number) => {
      openEditor(note, true, scrollTop)
    },
    [openEditor],
  )

  const handleExitEditor = useCallback((result: { stem: string; discarded: boolean }) => {
    setScreen('overview')
    setActiveNoteStem(null)
    setActiveNoteIsNew(false)
    setOverviewFocusStem(result.discarded ? null : result.stem)
  }, [])

  const handleExitTodoList = useCallback(() => {
    setScreen('overview')
  }, [])

  const handleOpenShortcuts = useCallback(() => {
    setScreen('shortcuts')
  }, [])

  const handleOpenNoteFromTodoList = useCallback((stem: string) => {
    const note = notes.find((n) => n.stem === stem)
    if (note) handleOpenNote(note, 0)
  }, [notes, handleOpenNote])

  const handleGlobalCreateNote = useCallback(() => {
    void (async () => {
      const res = await workspaceActions.createNote()
      if (!res.ok) return
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop || 0
      openEditor(res.note, true, currentScrollTop)
    })()
  }, [openEditor])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (rebuildLogOpen) return

      const action = getGlobalNavAction({
        screen,
        key: event.key,
        repeat: event.repeat,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        target: event.target,
      })
      if (!action) return

      event.preventDefault()

      if (action === 'workspaces') {
        setScreen('workspaces')
        return
      }

      if (action === 'overview') {
        setScreen('overview')
        return
      }

      if (action === 'todolist') {
        setScreen('todolist')
        return
      }

      if (action === 'shortcuts') {
        setScreen('shortcuts')
        return
      }

      handleGlobalCreateNote()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleGlobalCreateNote, rebuildLogOpen, screen])

  useEffect(() => {
    if (screen === 'editor' || rebuildLogOpen) return
    if (isTypingTarget(document.activeElement)) return
    void restoreAppInputFocus(appMainRef.current)
  }, [rebuildLogOpen, screen])

  return (
    <div className={`appRoot${isMac ? ' appRootMac' : ''}`}>
      {isMac ? <div className="windowDragRegion" data-tauri-drag-region /> : null}
      <header className="appHeader">
        <div className="appHeaderLeft">
          <div className="appBrand">Ponder</div>
          <div className="appScreenTitle">{title}</div>
        </div>

        {screen !== 'editor' ? (
          <div className="appHeaderRight">
            <button
              type="button"
              className={screen === 'overview' ? 'btn btnPrimary' : 'btn'}
              onClick={() => setScreen('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={screen === 'workspaces' ? 'btn btnPrimary' : 'btn'}
              onClick={() => setScreen('workspaces')}
            >
              Workspaces
            </button>
            <button type="button" className="btn" onClick={() => setRebuildLogOpen(true)}>
              View rebuild log
            </button>
          </div>
        ) : null}
      </header>

      <main className="appMain" ref={appMainRef} tabIndex={-1}>
        {screen === 'overview' ? (
          <Overview
            onManageWorkspaces={() => setScreen('workspaces')}
            onOpenNote={handleOpenNote}
            onCreateNote={handleCreateNote}
            restoreScrollTop={overviewScrollTop}
            restoreFocusStem={overviewFocusStem}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            includeTags={includeTags}
            onIncludeTagsChange={setIncludeTags}
            excludeTags={excludeTags}
            onExcludeTagsChange={setExcludeTags}
            isCompact={overviewCompact}
            onToggleCompact={() => setOverviewCompact((value) => !value)}
            onOpenShortcuts={handleOpenShortcuts}
          />
        ) : screen === 'editor' ? (
          activeNoteStem ? (
            <Editor stem={activeNoteStem} isNew={activeNoteIsNew} onExit={handleExitEditor} />
          ) : (
            <Overview
              onManageWorkspaces={() => setScreen('workspaces')}
              onOpenNote={handleOpenNote}
              onCreateNote={handleCreateNote}
              restoreScrollTop={overviewScrollTop}
              restoreFocusStem={overviewFocusStem}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              includeTags={includeTags}
              onIncludeTagsChange={setIncludeTags}
              excludeTags={excludeTags}
              onExcludeTagsChange={setExcludeTags}
              isCompact={overviewCompact}
              onToggleCompact={() => setOverviewCompact((value) => !value)}
              onOpenShortcuts={handleOpenShortcuts}
            />
          )
        ) : screen === 'todolist' ? (
          <TodoList onExit={handleExitTodoList} onOpenNote={handleOpenNoteFromTodoList} />
        ) : screen === 'shortcuts' ? (
          <Shortcuts />
        ) : (
          <Workspaces />
        )}
      </main>

      <RebuildLogModal isOpen={rebuildLogOpen} onClose={() => setRebuildLogOpen(false)} />
    </div>
  )
}

export default App
