# Phase 1: Workspaces - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can connect Ponder to workspace folders and switch between them quickly via slots 1-9. On relaunch, the app reopens the last active workspace slot (or guides the user to recover if unavailable). In a workspace, only root-level `*.md` notes appear; notes under `/.ponder/` and `/deleted/` do not appear.

</domain>

<decisions>
## Implementation Decisions

### Slot assignment UX
- Provide a dedicated Workspaces screen that lists slots 1-9 as the primary place to assign/manage workspace folders.
- Assigning a folder to a slot immediately switches the active workspace to that slot.
- Each slot displays the folder name plus the path (path can be secondary/truncated).
- Reassigning a slot (slot already has a folder) requires confirmation before replacing.

### Switching behavior
- Number keys 1-9 switch workspaces from the overview only (not global).
- Pressing a number for an unassigned slot opens the Workspaces screen.
- Switching to another slot is immediate and shows a subtle confirmation toast.
- Pressing the number for the currently active slot is a no-op.

### Relaunch + missing folder
- On relaunch, if the last active slot is unassigned, the app opens the Workspaces screen.
- If the last active slot's folder is missing/unreadable, the app opens the Workspaces screen with that slot shown as an error state.
- In the missing/unreadable case, the Workspaces screen highlights the first assigned valid slot as the fallback default selection.
- Non-active slots are not proactively checked for missing folders; missing is only surfaced when the user tries to switch to that slot.

### Claude's Discretion
- Exact Workspaces screen layout and interactions (e.g., list vs grid, how to focus a slot when opened from an empty-slot keypress).
- Exact toast copy, duration, and positioning.
- Path display details (truncation rules, tooltip/copy affordance).
- Whether/where to offer an explicit "clear slot" action (not required by phase success criteria).

</decisions>

<specifics>
## Specific Ideas

No specific product references or visual style requirements were provided for this phase.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-workspaces*
*Context gathered: 2026-01-30*
