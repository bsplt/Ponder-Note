import { useEffect, useMemo, useRef, useState } from 'react'
import { Overview } from './screens/Overview'
import { Workspaces } from './screens/Workspaces'
import { useWorkspaceStore, workspaceActions } from './stores/workspaceStore'
import './styles.css'

type Screen = 'overview' | 'workspaces'

function titleForScreen(screen: Screen): string {
  if (screen === 'overview') return 'Overview'
  return 'Workspaces'
}

function App() {
  const [screen, setScreen] = useState<Screen>('overview')
  const didInitialRoute = useRef(false)
  const title = useMemo(() => titleForScreen(screen), [screen])

  const loading = useWorkspaceStore((s) => s.loading)
  const activeStatus = useWorkspaceStore((s) => s.activeStatus)

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

    if (activeStatus !== 'ok') {
      setScreen('workspaces')
    }
  }, [activeStatus, loading])

  return (
    <div className="appRoot">
      <header className="appHeader">
        <div className="appHeaderLeft">
          <div className="appBrand">Ponder</div>
          <div className="appScreenTitle">{title}</div>
        </div>

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
      </header>

      <main className="appMain">
        {screen === 'overview' ? (
          <Overview onManageWorkspaces={() => setScreen('workspaces')} />
        ) : (
          <Workspaces />
        )}
      </main>
    </div>
  )
}

export default App
