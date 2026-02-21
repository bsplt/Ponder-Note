# Phase 6: Soft Delete - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can safely remove notes from their active workflow without losing data. Notes are moved to `<workspace>/deleted/` folder and no longer appear in search results or contribute todos. Restoration and viewing deleted notes are out of scope for v1.

</domain>

<decisions>
## Implementation Decisions

### Delete confirmation flow
- First `d` press: Apply distinct delete-warning color highlight to the focused row
- Show "Press `d` again to delete" message inline on the highlighted row (replace or append to title)
- Confirmation state persists until user acts AND has 3-5 second auto-cancel timeout
- Any key except `d` cancels the confirmation state (including ESC, arrow keys, etc.)
- Visual highlight remains static appearance throughout (no countdown, no urgency indicator)
- Any list change (new note, search filter applied) cancels the confirmation state
- After successful deletion, focus behavior is Claude's discretion (move to next/previous/same position)

### Deletion scope & side effects
- Sidecar metadata file (`.ponder/meta/<stem>.json`) remains in place when note is deleted (becomes orphaned)
- Deleted notes are completely invisible to the app (no count, no browsable view in v1)
- Filename conflicts in deleted/ are handled by auto-renaming with numeric increment suffix (`<timestamp>_1.md`, `<timestamp>_2.md`)
- Trust existing `list_todos` filter logic to exclude deleted/ notes (verify during planning, no explicit delete-time verification)
- Trust existing note loading logic to handle orphaned sidecars correctly (verify during planning)
- Delete operation atomicity is Claude's discretion
- Auto-create `deleted/` folder if it doesn't exist on first delete
- No limits on deleted/ folder size or count (manual cleanup outside app)

### Deleted folder organization
- Completely flat structure: all deleted notes in `deleted/<timestamp>.md`
- Numeric increment suffix for filename conflicts: `<timestamp>_1.md`, `<timestamp>_2.md`, etc.
- No deletion tracking (no log files, no per-note metadata in deleted/)
- No special markers or README in deleted/ folder

### User feedback & visibility
- Successful deletion shows both visual animation (row fades/slides out) AND status message ("Note deleted")
- Delete operation failures show status bar error (persistent until dismissed)
- Status bar errors support both auto-dismiss after timeout (5-10 seconds) AND manual dismiss (ESC or click)
- No way to view deleted/ contents from within app in v1 (manual Finder browsing only)
- No undo mechanism in v1 (manual restore via Finder only)
- Delete action available from Overview only (not from Editor)
- After deletion, focus uses standard focus highlight (no special treatment)
- No special treatment for notes with many open todos (delete works the same regardless)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for animation timing, status message duration, and error message formatting.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Restore functionality and browsing deleted notes are explicitly out of scope for v1.

</deferred>

---

*Phase: 06-soft-delete*
*Context gathered: 2026-02-02*
