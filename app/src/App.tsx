import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Overview } from './screens/Overview'
import { Editor } from './screens/Editor'
import { Workspaces } from './screens/Workspaces'
import { TodoList } from './screens/TodoList'
import type { NoteSummary } from './api/workspace'
import { useWorkspaceStore, workspaceActions } from './stores/workspaceStore'
import './styles.css'

type Screen = 'overview' | 'workspaces' | 'editor' | 'todolist'

function titleForScreen(screen: Screen): string {
  if (screen === 'overview') return 'Overview'
  if (screen === 'editor') return 'Editor'
  if (screen === 'todolist') return 'Todos'
  return 'Workspaces'
}

function App() {
  const [screen, setScreen] = useState<Screen>('overview')
  const [activeNoteStem, setActiveNoteStem] = useState<string | null>(null)
  const [activeNoteIsNew, setActiveNoteIsNew] = useState(false)
  const [overviewScrollTop, setOverviewScrollTop] = useState(0)
  const [overviewFocusStem, setOverviewFocusStem] = useState<string | null>(null)
  
  // Search state (persists when navigating to editor and back)
  const [searchText, setSearchText] = useState('')
  const [includeTags, setIncludeTags] = useState<string[]>([])
  const [excludeTags, setExcludeTags] = useState<string[]>([])
  
  const didInitialRoute = useRef(false)
  const title = useMemo(() => titleForScreen(screen), [screen])

  const loading = useWorkspaceStore((s) => s.loading)
  const activeStatus = useWorkspaceStore((s) => s.activeStatus)
  const notes = useWorkspaceStore((s) => s.notes)

  useEffect(() => {
    void workspaceActions.boot()
  }, [])

  useEffect(() => {
    if (loading) return

    if (!didInitialRoute.current) {
      didInitialRoute.current = true
      setScreen(activeStatus === 'ok' ? 'overview' : 'workspaces')
      return
    }

    if (activeStatus !== 'ok' && screen !== 'editor') {
      setScreen('workspaces')
    }
  }, [activeStatus, loading, screen])

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

  const handleOpenTodoList = useCallback(() => {
    setScreen('todolist')
  }, [])

  const handleExitTodoList = useCallback(() => {
    setScreen('overview')
  }, [])

  const handleOpenNoteFromTodoList = useCallback((stem: string) => {
    const note = notes.find(n => n.stem === stem)
    if (note) handleOpenNote(note, 0)
  }, [notes, handleOpenNote])

  return (
    <div className="appRoot">
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
          </div>
        ) : null}
      </header>

      <main className="appMain">
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
            onOpenTodoList={handleOpenTodoList}
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
              onOpenTodoList={handleOpenTodoList}
            />
          )
        ) : screen === 'todolist' ? (
          <TodoList
            onExit={handleExitTodoList}
            onOpenNote={handleOpenNoteFromTodoList}
          />
        ) : (
          <Workspaces />
        )}
      </main>
    </div>
  )
}

export default App
