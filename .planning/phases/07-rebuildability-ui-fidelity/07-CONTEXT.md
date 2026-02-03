# Phase 7: Rebuildability & UI Fidelity - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make UI styling centralized and themeable, ensure editor readability across window sizes, match Figma closely, and rebuild derived state when `.ponder/` is deleted without modifying Markdown note contents.

</domain>

<decisions>
## Implementation Decisions

### Theme scope & style control
- Centralized styling must cover all app surfaces (Overview, Editor, Todo List, workspace picker, modals).
- Single theme with tweakable variables (no user-facing theme switch).
- Tokenize colors, typography, spacing, and radii/shadows.
- No settings UI for theme control in this phase.

### Responsive editor layout
- Use a fixed max width with a centered content column.
- Base font size scales fluidly within min/max bounds.
- Target ~60-72 characters per line for readability.
- On narrow windows, reduce padding and keep the column centered.

### Figma fidelity rules
- All screens and components in Figma should match very closely.
- Layout can shift slightly, but overall feel must match.
- Buttons and inputs must match exactly; list rows/cards can be more flexible.
- Document only significant deviations (layout or interaction changes).

### Rebuild behavior UX
- If `.ponder/` is missing, rebuild is silent (no user messaging).
- Rebuild auto-fixes inconsistencies silently.
- Rebuild runs on app launch and when workspace changes.
- Provide a "View rebuild log" action with last run summary.

### Claude's Discretion
- Exact CSS token naming and organization within the centralized styles.
- Implementation details of the rebuild log presentation.

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

*Phase: 07-rebuildability-ui-fidelity*
*Context gathered: 2026-02-03*
