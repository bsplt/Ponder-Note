type OverviewProps = {
  onManageWorkspaces: () => void
}

export function Overview(props: OverviewProps) {
  return (
    <section className="panel">
      <h2 className="panelTitle">No workspace selected yet</h2>
      <p className="panelSubtitle">
        Assign a folder to a slot to get started.
      </p>

      <div className="panelActions">
        <button type="button" className="btn btnPrimary" onClick={props.onManageWorkspaces}>
          Manage workspaces
        </button>
      </div>
    </section>
  )
}
