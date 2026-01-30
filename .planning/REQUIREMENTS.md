# Requirements: Ponder

**Defined:** 2026-01-30
**Core Value:** I can capture meeting notes and reliably surface all open to-dos (and complete them in-place) without leaving Ponder.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Workspace

- [ ] **WS-01**: User can assign a workspace folder to a number slot (1-9) via a folder picker when the slot is empty
- [ ] **WS-02**: User can switch the active workspace from the overview using number keys 1-9
- [ ] **WS-03**: App remembers the last active workspace slot and reopens it on next launch
- [ ] **WS-04**: App indexes only `*.md` files in the workspace root (no recursion) and ignores `/.ponder/` and `/deleted/`
- [ ] **WS-05**: When creating a new note, app creates `<workspace>/<unix_ms_timestamp>.md`
- [ ] **WS-06**: App creates and uses `<workspace>/.ponder/meta/` for rebuildable per-note sidecar JSON metadata

### Notes & Metadata

- [ ] **NOTE-01**: Note title shown in the app is derived from the first line of the note; if the line starts with `#`, the displayed title strips the leading `#` and surrounding whitespace
- [ ] **NOTE-02**: Overview rows display a note timestamp derived from the filename UNIX ms timestamp (created_at)
- [ ] **NOTE-03**: App persists per-note metadata at `<workspace>/.ponder/meta/<stem>.json` with required fields `title` (string) and `created_at` (int) and optional fields `updated_at` (int) and `tags` (string[])
- [ ] **NOTE-04**: App ignores sidecar files whose corresponding `<workspace>/<stem>.md` does not exist

### Overview & Navigation

- [ ] **OV-01**: Overview list always includes a first row `+ New Note` that creates a note and opens it in the editor
- [ ] **OV-02**: Overview rows show: title, timestamp, and tags
- [ ] **OV-03**: User can open the focused note from overview using keyboard (arrow keys + Enter) and by mouse click
- [ ] **OV-04**: Search input filters the note list based on full-text matches in note title + body, while list rows still display only title/timestamp/tags
- [ ] **OV-05**: User can filter the note list by selecting tags and can combine tag filters with search

### Editor

- [ ] **ED-01**: User can edit a note as plain markdown text (edit-only; no markdown preview in v1)
- [ ] **ED-02**: Editor autosaves changes to disk (debounced) without requiring a manual save action
- [ ] **ED-03**: Editor supports undo/redo for text edits
- [ ] **ED-04**: User can leave the editor by pressing `ESC` and return to the overview
- [ ] **ED-05**: On leaving a note, any line that begins with `o ` is rewritten to begin with `[ ] ` (preserving the rest of the line)

### Tags

- [ ] **TAG-01**: Editor provides a dedicated tag input (comma-separated values); app trims whitespace, drops empty values, and stores tags into the note sidecar `tags` list
- [ ] **TAG-02**: Tag input provides suggestions/autocomplete from tags that exist in other notes within the active workspace

### Todos

- [ ] **TODO-01**: App extracts todos from notes by recognizing markdown checkbox patterns (`[ ]` and `[x]`, with or without a leading list marker) and shows only open todos by default
- [ ] **TODO-02**: From overview, user can open the Todo List screen via `T`
- [ ] **TODO-03**: Todo List groups todos by the parent note's tags and orders within groups by recency (based on note updated_at)
- [ ] **TODO-04**: Clicking a todo in the Todo List toggles its checked state in the source markdown file and reflects the new state in the Todo List UI
- [ ] **TODO-05**: A toggled todo remains visible in the Todo List until the user leaves the Todo List screen
- [ ] **TODO-06**: From a todo row, user can open the originating note in the editor

### Deletion

- [ ] **DEL-01**: In overview, pressing `d` on the focused note prompts for confirmation and requires pressing `d` again to delete
- [ ] **DEL-02**: Deleting a note moves the markdown file to `<workspace>/deleted/` and removes it from the overview
- [ ] **DEL-03**: Deleted notes do not appear in search results and do not contribute todos

### Reliability & Rebuildability

- [ ] **SAFE-01**: App writes note files using an atomic write strategy so a crash cannot leave a partially-written markdown file
- [ ] **SAFE-02**: Todo toggling never corrupts note content; if a safe toggle cannot be applied (e.g., file changed unexpectedly), the app does not write and surfaces an error
- [ ] **SAFE-03**: App can rebuild derived workspace state from scratch (sidecars + index under `.ponder/`) without losing the user's markdown note contents

### UI & Styling

- [ ] **UI-01**: UI styles are centralized and editable (CSS-first) to support modular theming and later breakpoints
- [ ] **UI-02**: Editor/reader content column width and base font size respond to window width within defined min/max bounds (to preserve readability)
- [ ] **UI-03**: UI matches provided Figma layouts/components closely; any intentional deviations are documented

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Rendering & Readability

- **PREV-01**: User can view a markdown preview (split or toggle) with consistent styling

### Productivity

- **TEMP-01**: User can create notes from a meeting template (agenda/notes/actions)
- **VIEWS-01**: User can save search/tag filters as reusable views
- **QUERY-01**: Search supports operators (e.g. tag:, status:, quotes) and shows match highlighting

### Shortcuts

- **CAP-01**: Global hotkey capture creates a new note or appends to an inbox note

## Out of Scope

Explicitly excluded for v1.

| Feature | Reason |
|---------|--------|
| Cloud sync / accounts / collaboration | Local-first by design; avoid trust and complexity costs in v1 |
| iOS / mobile app | macOS-only focus for v1 |
| Recursive folder scanning | Workspace root-only keeps identity and indexing simple |
| Markdown preview in v1 | Editor is intentionally edit-only for v1 |
| Hard delete | Use `deleted/` to prevent accidental data loss |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 0
- Unmapped: 37 ⚠

---
*Requirements defined: 2026-01-30*
*Last updated: 2026-01-30 after initial definition*
