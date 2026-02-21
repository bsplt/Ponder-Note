# Feature Research

**Domain:** Local-first markdown note app (macOS) with meeting notes + todo extraction
**Researched:** 2026-01-30
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Open a folder as a workspace (vault) | Markdown apps are file-first; users expect "my notes live in a folder" | MEDIUM | Treat folder as source of truth; no proprietary container; store app state separately. |
| Create / rename / move / delete notes & folders | Basic lifecycle management | MEDIUM | Rename/move must update internal references (recent files, tags index, todo references) even if markdown links are not rewritten. |
| Autosave + undo/redo | Notes apps are write-heavy; losing edits is unacceptable | HIGH | Atomic writes; preserve file permissions; avoid edit storms that rewrite whole file on tiny changes. |
| File system watching (external edits) | Users edit via other apps (VS Code, git, etc.) | HIGH | Detect and resolve external changes; avoid clobbering; handle rapid bursts of FS events; surface conflicts. |
| Fast, incremental full-text search | Users expect "type to filter" across many notes | HIGH | Local index (title + body); highlight matches; avoid UI stalls; keep index consistent with FS watcher. |
| Note list with sort + filter | Navigation baseline | LOW | Sort by updated, created, title; show titles even when searching body. |
| Keyboard-first navigation | macOS power users expect fast commands | MEDIUM | Command palette, quick switcher, focus management, predictable shortcuts. |
| Markdown editing essentials | Domain baseline | MEDIUM | Headings, lists, checkboxes, code blocks, links, inline code; don't break raw markdown. |
| Markdown rendering (preview or inline) | Users expect to read formatted output | MEDIUM | At minimum: consistent markdown styling; optional preview; keep editing non-destructive. |
| Tags (at least one form) | Basic organization mechanism | MEDIUM | Support inline `#tags` and/or sidecar tags; provide tag list + filter; normalize casing rules. |
| Recent notes + reopen last session | Expected desktop UX | LOW | Restore window layout, last opened note, last search query. |
| Soft delete / trash + restore | Accidental deletes happen | LOW | Trash view; restore to original path; purge option. |
| Basic import/export story | Users move between tools | LOW | Because files are markdown: "import" is open folder; "export" is copy/share markdown; avoid lock-in. |
| Attachment handling (minimal) | Notes often contain images/PDFs | MEDIUM | Decide: embed links to files in workspace vs managed attachment folder; drag/drop insert; don't silently relocate user files. |
| Multi-window / split view (at least 2 notes) | Desktop users compare notes | MEDIUM | Split editor/preview; or multiple windows; preserve keyboard flow. |
| Todo extraction from markdown checkboxes | Core promise: "todos from notes" | HIGH | Parse standard `- [ ]` / `- [x]`; aggregate across workspace; show context (note title, snippet); link back to source location. |
| Toggle todo state updates source note | Core promise: action list drives edits | HIGH | Patch file safely (line-based edits); preserve formatting/indent; avoid corrupting multi-byte chars; handle file changed since last parse. |
| Todo filters (open/done) + grouping | Users need triage | MEDIUM | Filter by status; group by note; search within todos; keep fast for large vaults. |
| Basic meeting-note ergonomics | Domain overlap: "meeting protocols" | MEDIUM | Quick create meeting note (timestamped); section headings (agenda/notes/actions); consistent template. |
| Reliability / recoverability | Local-first trust requirement | MEDIUM | Crash-safe writes; explicit "index rebuilding"; safe-mode if parsing/indexing fails. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Action items" extraction beyond checkboxes | Capture tasks even when notes aren't perfectly formatted | HIGH | Parse patterns like `Action:` / `TODO:` / `- [ ]`; configurable rules; avoid false positives. |
| Task metadata in plain text (due, scheduled, priority) | Makes "todos from notes" competitive with task apps without leaving markdown | HIGH | Support minimally invasive syntax (e.g., `due: 2026-02-01` or emoji dates); must be queryable and editable without GUI lock-in. |
| Task views as saved searches | Reusable GTD-like lenses without building a full task manager | MEDIUM | Saved filters (by tag/path/status/due); lightweight "dashboard" notes or sidebar views. |
| One-keystroke "capture" (global hotkey) | Keyboard-first differentiation on macOS | MEDIUM | Append to inbox note or create new; optional clipboard capture; must be instant and offline. |
| Deep linking to file+line (task jump) | Makes aggregated todos actionable | HIGH | Maintain stable anchors across edits; best-effort line mapping; degrade gracefully when the source moved. |
| Backlinks + wiki links (optional) | Supports "meeting protocols" as a knowledge system | HIGH | Parse `[[wikilinks]]` and/or markdown links; show backlinks panel; keep FS-index in sync. |
| Daily/weekly notes (journal) | Matches meeting-note workflow + planning | MEDIUM | Auto-create daily note; quick open by date; optional template variables. |
| Templates with variables | Meeting minutes consistency | MEDIUM | Variables like date/time, attendees, title; per-workspace templates; avoid executing arbitrary code in MVP. |
| Inline "toggle done" hotkey in editor | Faster than clicking checkboxes | LOW | E.g. `Cmd+Enter` toggles the current task line; must preserve indentation and list markers. |
| "Protocol mode" for meetings | Clear separation of minutes vs raw scratch | MEDIUM | Structured sections + action items list + decisions; export/share as clean markdown. |
| Streak-free, low-noise file writes | Makes git-friendly workflows pleasant | HIGH | Avoid rewriting entire file; stable line endings; preserve trailing spaces where meaningful; avoid reformat-on-save by default. |
| Workspace slots + per-workspace settings | Users juggle personal/work contexts | MEDIUM | Separate recent files, templates, tags config, indexing settings. |
| Local, privacy-first features (no account) | Differentiates from cloud-first tools | LOW | Clear "no login" story; optional opt-in integrations only. |
| Extensibility surface (minimal plugin hooks) | Lets power users adapt without bloating core | HIGH | Scriptable actions (later); start with URL schemes / CLI integration; stable APIs are hard. |
| Integrations: Reminders/Things export (one-way) | "Todos from notes" becomes real-world actionable | HIGH | One-way push is safer than two-way sync; keep mapping in sidecar metadata; avoid lock-in. |
| Search operators (path, tag, status) | Makes large vault manageable without heavy UI | HIGH | Query parser + index fields; keep errors understandable (no "regex only" UX). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaboration | "Like Google Docs" | Hard for file-based markdown; conflict resolution becomes the product | Export/share markdown, or later read-only publish; defer collab. |
| Two-way sync with external task managers | "Make it my one system" | Mapping is lossy; creates confusing conflict states | Start with one-way export or deep links; keep source-of-truth in notes. |
| Proprietary database-only storage | "Faster, easier sync" | Breaks trust + portability; complicates external editing | Keep markdown as truth; use an internal index DB as cache only. |
| Aggressive auto-format / auto-rewrite markdown | "Prettier notes" | Breaks user intent; causes huge diffs; can corrupt edge-case markdown | Provide optional formatting commands; default to minimal edits. |
| AI features enabled by default (cloud) | "Auto summarize meetings" | Privacy risk; cost; trust breaker for local-first | Make AI opt-in with clear data handling; consider on-device only later. |
| Building a full calendar client | "Meeting notes need calendar" | Large surface area; distracts from note+todo core | Optional links/import of event title/time; keep calendar integration lightweight. |
| Graph view as a primary navigation metaphor | "Looks cool" | Often low practical value; heavy performance cost | Backlinks + quick switcher + search provide real utility first. |
| Custom task syntax that isn't readable markdown | "More structure" | Users can't edit in other editors; vendor lock-in | Use common markdown checkboxes + minimal inline metadata. |
| Auto-tagging / auto-classification | "Organize for me" | Wrong tags create noise; hard to undo | Offer simple tag suggestions or manual tag hygiene tools. |

## Tricky Areas (Implementation Hotspots)

| Area | Why It's Tricky | What Good Looks Like |
|------|------------------|------------------------|
| File watching + conflict handling | macOS FS events are bursty; users edit via other tools; races with autosave | External edits appear quickly; no silent overwrite; clear conflict UX; index stays consistent. |
| Safe todo toggling (patching) | Must edit user-authored markdown without reformatting; source may move | Toggles only the checkbox token; preserves indentation/bullets; handles concurrent edits; never corrupts file. |
| Search + indexing | Users expect instant results; indexing must keep up with changes | Sub-100ms query for typical vault; incremental updates; searchable titles+body+tags+path; clear operator UX. |
| Editor UX (keyboard-first) | Focus bugs and keybinding collisions kill trust | Predictable focus; command palette is fast; shortcuts are discoverable/customizable; minimal modal friction. |
| Markdown parsing edge cases | Checkboxes in code blocks, quotes, nested lists, tables | Parser respects context; avoids false tasks; keeps stable task identity across edits when possible. |

## Feature Dependencies

```
[File System Watcher + Safe Writer]
    |--requires--> [Incremental Index (title/body/path/tags)]
    |                |--requires--> [Search UI + Operators]
    |                `--requires--> [Todo Aggregation View]
    |                                 `--requires--> [Todo Toggle Patching]
    `--requires--> [Conflict Detection + Recovery]

[Markdown Parser]
    |--requires--> [Todo Extraction]
    `--enhances--> [Rendering/Preview]

[Templates]
    `--enhances--> [Meeting Note Creation]

[Backlinks/Wikilinks]
    `--requires--> [Index with Link Graph]
```

### Dependency Notes

- **Todo toggling requires safe writing:** the "toggle done" action must patch the correct line even if the file changed since last parse; otherwise data loss/conflicts happen.
- **Search requires an index:** naive grep-per-keystroke doesn't scale and stalls UI; an index enables operators (tag/path/status) and quick filtering.
- **FS watcher is foundational:** without robust external-change handling, any "local folder" promise breaks for git/other editors.
- **Meeting notes depend on templates (for consistency):** without templates, "protocol mode" becomes a manual convention that won't stick.

## MVP Definition

### Launch With (v1)

Minimum viable product - validate the "todos from notes" promise in a keyboard-first macOS workflow.

- [ ] Workspace folder open + workspace slots - establish file-first ownership and multi-context switching
- [ ] Editor (markdown text, autosave, undo/redo) - core writing loop must feel trustworthy
- [ ] Overview list + incremental search (titles shown, filter by query) - navigation must be fast
- [ ] Tags field (sidecar or inline) + tag filter - minimal organization
- [ ] Todo aggregation view - show tasks with note title + snippet + status
- [ ] Toggle todo updates source - the key differentiator must work reliably
- [ ] Soft delete/trash - prevents accidental data loss during early usage

### Add After Validation (v1.x)

- [ ] Saved task views (filters) - add once users accumulate enough tasks to feel pain
- [ ] Meeting note templates (agenda/notes/actions) - add once meeting usage is confirmed
- [ ] Search operators (tag/path/status) - add when simple search stops scaling
- [ ] Global quick capture - add once daily usage pattern is established

### Future Consideration (v2+)

- [ ] Task metadata (due/recurring) - only if users need scheduling beyond "checklist"
- [ ] Backlinks/wikilinks - only if knowledge graph is part of Ponder's positioning
- [ ] Integrations (Reminders/Things) - only if users ask for execution outside the vault
- [ ] Plugins / scripting - only if core is stable; backwards-compat commitments are real

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Todo aggregation view | HIGH | MEDIUM | P1 |
| Toggle todo updates source | HIGH | HIGH | P1 |
| Fast search (incremental) | HIGH | HIGH | P1 |
| File watching + conflict safety | HIGH | HIGH | P1 |
| Keyboard-first navigation (palette/switcher) | HIGH | MEDIUM | P1 |
| Tags + tag filter | MEDIUM | MEDIUM | P1 |
| Soft delete/trash | MEDIUM | LOW | P1 |
| Saved task views | HIGH | MEDIUM | P2 |
| Meeting note templates | MEDIUM | MEDIUM | P2 |
| Search operators (tag/path/status) | MEDIUM | HIGH | P2 |
| Global quick capture | MEDIUM | MEDIUM | P2 |
| Backlinks/wikilinks | MEDIUM | HIGH | P3 |
| Task scheduling (due/recurring) | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Bear | Obsidian (+ Tasks plugin) | NotePlan | Our Approach |
|---------|------|----------------------------|----------|--------------|
| Tagging + tag navigation | Strong tag-centric organization (docs emphasize tags/nested tags) | Common via tags in vault (core) | Promotes tags/mentions | Keep simple: tags field + filter; avoid auto-tagging; keep portable. |
| Backlinks / bidirectional links | Supports backlinks/info panel (docs list backlinks) | Core concept in Obsidian; backlinking is common | Markets bi-directional linking | Defer: focus on todos; add backlinks only if it strengthens "meeting protocols". |
| Markdown-first editing | Supported (docs: markdown usage) | Markdown-first (core) | Explicitly "powered by Markdown... stored in plaintext" | Preserve raw markdown; avoid reformat-on-save; patch tasks surgically. |
| Task aggregation across notes | Not a primary focus (checklists exist but not marketed as task system) | Tasks plugin supports queries across vault and toggling updates source | Markets "advanced task scheduling... filters... recurring" | Core: aggregate standard checkboxes; add lightweight filters before scheduling features. |
| Toggle task status updates source | N/A | Explicitly supported by Tasks plugin | Likely supported (marketing implies tasks in notes), but exact behavior varies | Guarantee this for checkboxes; handle conflicts safely; make it keyboard-first. |
| Templates | Supported (docs list templates) | Core/community plugin ecosystem | Markets templates + JS templating | Provide meeting templates early (v1.x), but keep templating simple at first. |
| Search | Docs emphasize search + search/replace | Core search; often with plugins for advanced query | Markets command bar + search | Invest early in a fast index + UX (titles shown, body matched, no UI stalls). |
| Privacy/local-first story | Strong local + optional sync/encryption (docs emphasize note safety) | Local-first vault; sync via optional services | Markets offline-first + sync | "No account" baseline; make any cloud/AI opt-in and clearly communicated. |

## Sources

- Bear help docs (feature categories include tags, backlinks, search, shortcuts, privacy): https://bear.app/faq/
- NotePlan product page (tasks+notes+calendar, templates, command bar, backlinks, scheduling): https://noteplan.co/
- Obsidian Tasks plugin README (task queries; toggling updates source; due/recurring support): https://github.com/obsidian-tasks-group/obsidian-tasks
- NotePlan help center (x-callback URL scheme examples / custom links): https://help.noteplan.co/article/47-create-custom-links

---
*Feature research for: Ponder (macOS local markdown notes + todo extraction)*
*Researched: 2026-01-30*
