# Phase 4: Search & Tags - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can organize and find notes quickly using tags and full-text search. Notes display tags in the overview, users can edit tags in the editor with autocomplete suggestions, and filter notes by selecting tags and/or entering search text. Tag filtering and search combine to narrow results.

</domain>

<decisions>
## Implementation Decisions

### Tag Display in Overview
- Tags appear as **right-aligned subtle pill badges** (rounded background, muted colors, small padding)
- Tags display in **alphabetical order** (not user-defined or frequency-based)
- **Show all tags with wrapping** if a note has many tags (no truncation/+N indicator)
- When note has no tags: **empty/blank space** (no placeholder text)
- **Clicking a tag filters by that tag** (adds include filter pill to search bar)

### Tag Editing in Editor
- Tag input appears **at top of editor** (above note content)
- **Pill-based input** (tags become pills as you type, like search bar)
- Placeholder shows simple **"+"** after existing pills
- **Autocomplete dropdown appears as soon as you start typing**
- Dropdown shows **just tag names** (no frequency counts)
- **Comma or Enter** creates new tag pill from typed text
- Tags are **permissive** (allow mixed case, spaces, special chars — user controls formatting)
- **Silently deduplicate** if user creates duplicate tag on same note
- **Autosave on blur** (when user leaves tag input field)
- **Click pill to edit in-place** (clicking a tag pill makes it editable text again)
- **Arrow keys navigate between pills** (left/right move focus between pills and text cursor)

### Search Behavior
- Search filters **real-time (as you type)** (no debounce, no Enter required)
- Search is **case-insensitive**
- Search covers **title + body** (not tags)
- **No match highlighting** — non-matching notes are hidden (classical filter)
- Multi-word queries use **AND logic** ('meeting notes' matches notes with both words)
- **Basic wildcards supported** (e.g., 'meet*' matches 'meeting')
- **No search history** (each search is fresh)
- **Search persists** when opening a note and returning to overview
- **Cmd+F keyboard shortcut** focuses search input
- **Search input styling changes** when filtering is active (visual indicator)
- No results: **show empty state message** (no retry hint)

### Filtering & Combination
- **Tag filters show as pills inside search input** (before text cursor)
- Pills appear **first, then text cursor**: `[work] [personal] | <cursor>`
- Remove pills via **both click X and backspace** (mouse + keyboard support)
- Multiple tag filters combine with **AND logic** (must have all selected tags)
- Tag filters + search text combine with **AND logic** (must match both)
- **Support tag exclusion**: Cmd/Ctrl + click on tag to exclude (not include)
- Excluded tags show with **different color and "-" prefix** (e.g., `[-work]`)
- Click cycle in overview rows: **Unselected → Include → Unselected** (exclude via Cmd+click)
- **No dedicated tag browser** (only click tags visible in note rows to filter)
- Filtered results maintain **chronological order (by timestamp)** (not relevance-based)
- Support **typing '#work' in search** to create tag filter pill
- `#` immediately triggers **inline autocomplete** (ghost text, Tab to accept)
- Type **'#-work'** literally to create excluded tag filter pill

### Claude's Discretion
- Exact pill styling (colors, padding, border radius)
- Search input styling details when active
- Empty state message wording
- Autocomplete dropdown styling and keyboard navigation details
- Edge cases around wildcard parsing

</decisions>

<specifics>
## Specific Ideas

- Tag filtering should feel integrated with search (unified search bar experience)
- Pills behave consistently between editor tag input and search bar filters
- Keyboard-first interactions (arrow keys, backspace, Tab, Cmd+F, Cmd+click)
- Classical filtering (hide non-matching notes, no fancy highlighting or relevance scoring)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-search-tags*
*Context gathered: 2026-02-01*
