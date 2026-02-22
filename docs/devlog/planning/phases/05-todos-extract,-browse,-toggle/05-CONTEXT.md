# Phase 5: Todos (Extract, Browse, Toggle) - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface open todos across all notes and let users complete them in-place from a dedicated todo list — without leaving Ponder. Extract todos from Markdown checkbox patterns, organize them for browsability by tag groups, and toggle them back to the source file safely.

</domain>

<decisions>
## Implementation Decisions

### Todo grouping & ordering

- **Cross-group appearance:** Todos from notes with multiple tags appear in ALL matching tag groups (e.g., note tagged `work, urgent` shows todos under both "work" and "urgent")
- **Within-group ordering:** Todos ordered by most recently modified note (recently edited notes bubble to top of their groups)
- **Untagged notes:** Get their own "Untagged" section at the bottom of the list
- **Completed todo visibility:** Completed todos stay in place with checked checkbox until user leaves Todo List screen
- **Tag group ordering:** Groups ordered by most recently edited (groups with recent activity appear first)
- **Cross-group sync:** Checking one instance of a todo automatically checks all instances across groups immediately
- **Group collapse:** No collapse/expand — all groups always visible
- **Empty groups:** Groups with all completed todos stay visible showing checked items; truly empty groups (no checked todos at all) are hidden
- **Group headers:** Show just tag name (e.g., "work", "personal")
- **Note title display:** Do not show note titles — tags provide sufficient context
- **Multi-line todos:** Show full text (wrap to multiple lines, no truncation)
- **Nested checkboxes:** Show as separate flat items (no hierarchy preservation)
- **Sort stability:** When notes have same modified time, sort alphabetically by note title

### Todo list interaction model

- **Toggle interaction:** Click anywhere on the row to toggle checkbox
- **Opening source note:** Small icon button (arrow) at right of row opens note in Editor
- **Keyboard navigation:** Arrow keys to navigate, Space to toggle, Enter to open note in Editor
- **Batch actions:** No batch operations — one todo at a time
- **Visual feedback on toggle:** Instant checkbox change (optimistic update)
- **Todo List access:** T key only works from Overview (not from Editor)
- **Navigation focus:** Remember focus position when returning from Editor
- **Todo text editing:** No inline editing — edit only in source note
- **Closing Todo List:** ESC key only (consistent with Editor exit pattern)
- **Multi-instance updates:** Toggling one instance updates all instances immediately across groups
- **Open note behavior:** Opens at top of note (user navigates to find specific todo)

### Visual presentation

- **Information per todo:** Just checkbox + text (minimal, clean)
- **Open-note icon:** Always visible on every row (arrow icon suggesting navigation)
- **Tag group separation:** Tag name headers (no dividers, background shading, or extra spacing)
- **Checkbox styling:** Custom design (optimized for the app, not Markdown preview or system native)
- **Empty state:** "No open todos" message (simple, centered, no explanation or encouragement)
- **Completed todo styling:** Checked box + dimmed/gray text (no strikethrough)
- **Overall layout:** Same structure as Overview (replaces note list, consistent layout)
- **Tag header styling:** Just the tag name (no emoji, icon, or background color)
- **Scroll behavior:** Free scrolling through entire list (no sticky headers or pagination)
- **Focus indicator:** Both background highlight + border for clear indication
- **Arrow icon style:** → or similar (suggesting navigation to source note)
- **Spacing density:** Comfortable spacing (balanced readability)
- **Group header prominence:** Subtle (slightly differentiated, blends with flow)
- **Todo text wrapping:** Wrap to multiple lines (full text visible, expands row height)
- **Loading state:** Simple "Loading todos..." text message
- **Color scheme:** Same as Overview (consistent theme throughout app)

### Empty & error states

- **No todos message:** Just "No open todos" (simple, centered text)
- **Toggle failure feedback:** Show toast notification (temporary message)
- **Toggle failure recovery:** Auto-refresh to current state after error
- **Deleted note handling:** Silent removal on next refresh
- **File system errors:** Prompt user action with guidance (e.g., "Check workspace permissions")
- **Malformed checkboxes:** Skip silently (only show parseable checkboxes)
- **Empty group visibility:** Only show groups that have checked todos remaining; truly empty groups hidden
- **Toast duration:** Errors stay until user dismisses (no auto-hide)
- **Concurrent editing:** Not applicable (can't have Editor and Todo List viewing same note simultaneously)
- **Performance with many todos:** Show all todos (rely on scrolling, no pagination or virtualization)
- **Extraction errors:** Silent logging (don't notify user of individual file read errors)

### Claude's Discretion

- Auto-refresh strategy (technical implementation of automatic sync when returning to Todo List)
- Toggle conflict handling (when optimistic update fails due to external file change)
- Race condition handling (rapid sequential toggles)

</decisions>

<specifics>
## Specific Ideas

- Todo List should feel like a natural extension of the Overview — same visual language, just showing a different lens on the notes
- The icon button for opening notes should be subtle but always accessible (not hidden until hover)
- Grouping by tags with recent-activity ordering means users see their active work first naturally

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-todos-extract,-browse,-toggle*
*Context gathered: 2026-02-02*
