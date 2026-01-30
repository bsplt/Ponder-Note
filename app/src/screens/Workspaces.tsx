export function Workspaces() {
  return (
    <section className="panel">
      <h2 className="panelTitle">Workspace slots</h2>
      <p className="panelSubtitle">Slots 1-9 are currently unassigned.</p>

      <div className="slotGrid" role="list">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className="slot" role="listitem">
            <div className="slotNumber">{n}</div>
            <div className="slotBody">
              <div className="slotName">Unassigned</div>
              <div className="slotPath path">(no folder)</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
