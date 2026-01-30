# Roadmap: Ponder (v1)

**Depth:** standard

Ponder v1 ships a local-first macOS notes workflow: pick a workspace folder, browse/search notes, edit Markdown with autosave, and manage extracted todos that can be completed in-place.

Phases are derived from the v1 requirements and ordered by dependency (workspace identity -> note/edit loop -> organization/find -> todo loop -> delete -> polish/recovery).

---

## Phases

### Phase 1 - Workspaces

**Goal:** Users can connect Ponder to workspace folders and switch between them quickly.

**Dependencies:** None

**Requirements:** WS-01, WS-02, WS-03, WS-04

**Success Criteria (observable):**
1. User can assign a workspace folder to an empty slot (1-9) using a folder picker.
2. From the overview, user can switch the active workspace using number keys 1-9.
3. On relaunch, the app reopens the last active workspace slot.
4. In a workspace, only root-level `*.md` notes appear; notes under `/.ponder/` and `/deleted/` do not appear.

### Phase 2 - Note Identity & Sidecar Metadata

**Goal:** Notes have stable identity, titles, timestamps, and rebuildable per-note metadata.

**Dependencies:** Phase 1

**Requirements:** WS-05, WS-06, NOTE-01, NOTE-02, NOTE-03, NOTE-04

**Success Criteria (observable):**
1. Creating a new note results in a file at `<workspace>/<unix_ms_timestamp>.md`.
2. The app stores per-note metadata at `<workspace>/.ponder/meta/<stem>.json` with `title` and `created_at` present.
3. The note title shown in the app matches the first line of the note (with leading `#` stripped when present).
4. The note timestamp shown in the app matches the filename UNIX-ms timestamp (created_at).
5. Orphan sidecars (no corresponding `<stem>.md`) do not create visible “ghost” notes.

### Phase 3 - Overview <-> Editor Loop

**Goal:** Users can create/open/edit notes and reliably return to the overview without losing changes.

**Dependencies:** Phase 2

**Requirements:** OV-01, OV-03, ED-01, ED-02, ED-03, ED-04, ED-05, SAFE-01

**Success Criteria (observable):**
1. Overview always includes a first row `+ New Note` that creates a note and opens it in the editor.
2. User can open the focused note from the overview via keyboard (arrow keys + Enter) and by mouse click.
3. User can edit plain Markdown text; changes autosave to disk without a manual save action.
4. User can undo/redo text edits.
5. User can press `ESC` to leave the editor and return to the overview; on leaving, any line starting with `o ` is rewritten to start with `[ ] `.
6. A crash during a write does not leave a partially-written Markdown file on disk.

### Phase 4 - Search & Tags

**Goal:** Users can organize and find notes quickly using tags and full-text search.

**Dependencies:** Phase 3

**Requirements:** OV-02, OV-04, OV-05, TAG-01, TAG-02

**Success Criteria (observable):**
1. Overview rows show each note’s title, timestamp, and tags.
2. In the editor, user can add/edit tags via a dedicated comma-separated input; tags are trimmed, empty values are dropped, and saved.
3. Tag input suggests existing tags from other notes in the active workspace.
4. Search input filters the note list based on matches in note title + body.
5. User can filter the note list by selecting tags and can combine tag filters with search.

### Phase 5 - Todos (Extract, Browse, Toggle)

**Goal:** Users can surface open todos across notes and complete them in-place from a dedicated todo list.

**Dependencies:** Phase 4

**Requirements:** TODO-01, TODO-02, TODO-03, TODO-04, TODO-05, TODO-06, SAFE-02

**Success Criteria (observable):**
1. From overview, user can open the Todo List screen via `T`.
2. The Todo List shows todos extracted from Markdown checkbox patterns and shows only open todos by default.
3. Todos are grouped by the parent note’s tags and ordered within groups by recency.
4. Clicking a todo toggles its checked state in the source Markdown file and the Todo List reflects the new state.
5. A toggled todo remains visible in the Todo List until the user leaves the Todo List screen.
6. From a todo row, user can open the originating note in the editor.
7. If a safe toggle cannot be applied, the app does not write and surfaces an error; note contents remain uncorrupted.

### Phase 6 - Soft Delete

**Goal:** Users can safely remove notes from their active workflow without losing data.

**Dependencies:** Phase 3

**Requirements:** DEL-01, DEL-02, DEL-03

**Success Criteria (observable):**
1. In overview, pressing `d` on the focused note prompts for confirmation and requires pressing `d` again to delete.
2. Deleting a note moves the Markdown file to `<workspace>/deleted/` and removes it from the overview.
3. Deleted notes do not appear in search results and do not contribute todos.

### Phase 7 - Rebuildability & UI Fidelity

**Goal:** The app is themable, readable across window sizes, matches the provided Figma, and can rebuild derived state without risking note contents.

**Dependencies:** Phase 6

**Requirements:** SAFE-03, UI-01, UI-02, UI-03

**Success Criteria (observable):**
1. UI styling is centralized and can be modified (CSS-first) without hunting through components.
2. Editor content column width and base font size respond to window width within defined min/max bounds.
3. UI matches the provided Figma layouts/components closely; any intentional deviations are documented.
4. If the user deletes derived workspace state under `.ponder/`, the app can rebuild it and still shows correct notes/search/todos without modifying Markdown note contents.

---

## Progress

| Phase | Name | Status |
|------:|------|--------|
| 1 | Workspaces | Pending |
| 2 | Note Identity & Sidecar Metadata | Pending |
| 3 | Overview <-> Editor Loop | Pending |
| 4 | Search & Tags | Pending |
| 5 | Todos (Extract, Browse, Toggle) | Pending |
| 6 | Soft Delete | Pending |
| 7 | Rebuildability & UI Fidelity | Pending |
