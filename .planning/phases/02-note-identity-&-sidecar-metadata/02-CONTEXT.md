# Phase 2: Note Identity & Sidecar Metadata - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide stable note identity via timestamp-based filenames and per-note sidecar metadata (title + created_at). Titles display from the note's first line (with heading markers handled), timestamps derive from the filename, and orphan sidecars never create visible notes.

</domain>

<decisions>
## Implementation Decisions

### Title derivation & fallback
- Trim only leading/trailing whitespace; preserve internal spacing.
- Convert tabs to spaces before trimming.
- Strip all leading `#` after optional leading spaces.
- If the first line is empty/whitespace, marker-only (`#`, `###`), or `---`, the title is `Untitled`.
- Strip common list/quote prefixes (`- `, `* `, `1. `, `> `) and checkbox prefixes (`- [ ]`, `- [x]`).
- Strip inline Markdown formatting markers (emphasis/code). For Markdown links, use link text only.
- Keep trailing `#` markers when present.

### Timestamp display format
- Absolute timestamps only.
- Use German-style formatting (e.g., `30.01.2026 14:05`, 24-hour clock).
- Notes from the current day show time; older notes show date only.
- Use local timezone.

### Sidecar lifecycle & rebuild
- For new notes, write the sidecar on first save/edit.
- Update sidecar title on editor exit.
- If a sidecar is missing or invalid, rebuild from the note silently.
- When rebuilding, preserve unknown fields and ensure `created_at` matches the filename timestamp.
- If `created_at` conflicts with the filename timestamp, the filename wins.

### Orphan sidecar cleanup
- Orphan sidecars are ignored by default (no automatic cleanup).
- Manual cleanup only; when run, show a summary (e.g., count removed).

### Claude's Discretion
- When to create sidecars for existing notes that lack one.
- When to resync sidecars after external on-disk note edits.
- Whether manual orphan cleanup uses a grace period (and its duration).

</decisions>

<specifics>
## Specific Ideas

No specific references — decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-note-identity-&-sidecar-metadata*
*Context gathered: 2026-01-30*
