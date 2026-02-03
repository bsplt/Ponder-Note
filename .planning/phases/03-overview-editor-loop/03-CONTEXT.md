# Phase 3: Overview <-> Editor Loop - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Create/open/edit Markdown notes from the overview with autosave, undo/redo, and a reliable return to overview. On exit, rewrite lines that start with `o ` into `[ ] ` and ensure crash-safe writes. No new capabilities beyond this loop.

</domain>

<decisions>
## Implementation Decisions

### New note initialization
- New notes start with `# ` only (no trailing blank line).
- Cursor lands after `# `.
- If the title line is empty, show "Untitled" in the overview (display-only, do not write it into the file).
- If a new note is created and the user exits without typing, discard the empty note.
- Pressing Enter on the title line just moves to the next line (no extra blank line inserted).
- No body placeholder text.

### Autosave feedback & failure
- No visible save status during normal autosave.
- Autosave is debounced after a short pause and always runs on leaving the editor.
- If exiting while a save is pending, finish the save before returning to the overview.
- On autosave failure, show a non-blocking banner that includes the last successful save time.
- The editor remains editable after a save failure.
- If the user exits with unsaved changes due to a failure, warn them and allow exit.
- Auto-retry saves in the background after failures.

### Overview <-> editor navigation
- Preserve overview scroll position on return.
- Focus/selection returns to the edited note.
- Mouse: single click selects only; double click opens (Enter also opens).
- Opening a note places the cursor at the start of the file.
- Editor includes a visible "Back to overview" control in addition to ESC.
- Reopening a note starts at the top (no scroll restore).
- `+ New Note` row is keyboard-focusable and actionable via arrow keys + Enter.

### `o ` rewrite on exit
- Convert indented `o ` lines too, preserving original indentation.
- Skip conversion inside fenced code blocks and blockquotes.
- Case-insensitive conversion for `o ` and `O `.
- Match only `o` + single space (not tabs).
- Convert only when there is text after `o `.

### Claude's Discretion
- Whether to provide a manual "Retry save" action in the error banner.
- Whether the error banner is dismissible while the issue persists.
- Consider live `o ` conversion only if it is low-risk and low-overhead; otherwise keep it exit-only.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-overview-editor-loop*
*Context gathered: 2026-01-31*
