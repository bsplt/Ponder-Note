type ShortcutRow = {
  keys: string[]
  action: string
}

type ShortcutGroup = {
  title: string
  rows: ShortcutRow[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global (outside editor, not typing)',
    rows: [
      { keys: ['o'], action: 'Go to Overview' },
      { keys: ['w'], action: 'Go to Workspaces' },
      { keys: ['t'], action: 'Go to Todos' },
      { keys: ['n'], action: 'Create new note' },
      { keys: ['h'], action: 'Open shortcuts page' },
      { keys: ['?'], action: 'Open shortcuts page' },
    ],
  },
  {
    title: 'Overview',
    rows: [
      { keys: ['1..9'], action: 'Switch workspace slot' },
      { keys: ['Arrow Down', 'Arrow Up'], action: 'Move note selection' },
      { keys: ['Enter'], action: 'Open selected note or create a new note' },
      { keys: ['d', 'd'], action: 'Delete selected note (with confirmation)' },
      { keys: ['c'], action: 'Toggle compact list mode' },
      { keys: ['Cmd/Ctrl + f'], action: 'Focus search input' },
      { keys: ['Esc'], action: 'Clear search and tag filters' },
    ],
  },
  {
    title: 'Search input (Overview)',
    rows: [
      { keys: ['Esc'], action: 'Clear search + filters and blur' },
      { keys: ['Backspace'], action: 'Remove last tag pill (when input is empty)' },
      { keys: ['Enter'], action: 'Create tag pill for #tag or #-tag' },
      { keys: ['Space'], action: 'Create tag pill for #tag or #-tag' },
    ],
  },
  {
    title: 'Editor',
    rows: [
      { keys: ['Esc'], action: 'Exit editor' },
      { keys: ['e'], action: 'Switch from preview to edit mode' },
      {
        keys: ['o', 'Space'],
        action: 'Type o at line start (o ); on exit it is replaced with [ ] to create a todo',
      },
    ],
  },
  {
    title: 'Editor tag input + autocomplete',
    rows: [
      { keys: ['Enter', ','], action: 'Create a tag pill' },
      { keys: ['Backspace'], action: 'Remove last tag pill (when input is empty)' },
      { keys: ['Arrow Down', 'Arrow Up'], action: 'Move autocomplete selection' },
      { keys: ['Tab', 'Enter'], action: 'Accept autocomplete suggestion' },
      { keys: ['Esc'], action: 'Close autocomplete' },
    ],
  },
  {
    title: 'Editor preview todo rows',
    rows: [
      { keys: ['Enter'], action: 'Toggle focused todo' },
      { keys: ['Arrow Down', 'Arrow Up'], action: 'Move focused todo row' },
    ],
  },
  {
    title: 'Todos screen',
    rows: [
      { keys: ['Arrow Down', 'Arrow Up'], action: 'Move selection' },
      { keys: ['Space'], action: 'Toggle focused todo' },
      { keys: ['Enter'], action: 'Open source note' },
      { keys: ['Esc'], action: 'Back to overview' },
    ],
  },
]

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="shortcutKeys">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="shortcutKeysItem">
          <kbd className="shortcutKey">{key}</kbd>
        </span>
      ))}
    </div>
  )
}

export function Shortcuts() {
  return (
    <section className="panel shortcutsPanel">
      <div className="shortcutsHeader">
        <h2 className="panelTitle">Keyboard shortcuts</h2>
        <p className="panelSubtitle">Use o, w, or t to leave this page.</p>
      </div>

      <div className="shortcutsGroups">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className="shortcutsGroup" aria-label={group.title}>
            <h3 className="shortcutsGroupTitle">{group.title}</h3>
            <div className="shortcutsRows">
              {group.rows.map((row, index) => (
                <div key={`${group.title}-${row.action}-${index}`} className="shortcutRow">
                  <ShortcutKeys keys={row.keys} />
                  <div className="shortcutAction">{row.action}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
