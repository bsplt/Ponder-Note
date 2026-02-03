# Project Research Summary

**Project:** Ponder
**Domain:** macOS-only, local-first Markdown notes app (workspace folder) with extracted todos and full-text search
**Researched:** 2026-01-30
**Confidence:** MEDIUM

## Executive Summary

Ponder is a macOS desktop notes app where the user’s data is plain Markdown files in a chosen workspace folder, with lightweight sidecar metadata and a rebuildable local index for fast search and todo aggregation. The “expert default” architecture for this shape is a Web UI for interaction + a Rust core that owns all filesystem IO, indexing, parsing, and in-source todo mutations, connected via Tauri commands (user intent) and events (background invalidation/progress).

The strongest recommendation across research is to be strict about “source of truth vs derived”: Markdown + sidecars are authoritative; everything else (FTS index, todo cache, inventories) lives under `<workspace>/.ponder/` and can be deleted/rebuilt safely. Implement SQLite FTS5 as the embedded search/index backend owned by the Rust core, and treat filesystem watcher events as hints that trigger a reconcile pipeline (stat/read/derive) rather than as semantically reliable operations.

The key risk is trust loss from drift or data loss: unsafe autosave/toggle writes and brittle watcher/index logic will produce silent overwrites, stale search/todo results, or corrupted Markdown. Mitigation is to front-load safe write semantics (atomic writes + conflict detection), define one canonical derivation pipeline, store fingerprints per note, and ship explicit repair paths early (reindex file/workspace, conflict copies, index freshness UI).

## Key Findings

### Recommended Stack

The stack is a macOS-only Tauri 2 app with a React/TypeScript Web UI and a Rust core. Use SQLite FTS5 for the rebuildable full-text index and derived tables (todos, inventory) so search and filtering stay fast without introducing external services. Keep filesystem access and indexing in Rust to minimize Tauri capability surface and prevent split-brain logic.

**Core technologies:**
- Tauri 2.9.x: desktop shell + secure IPC — v2 capabilities model + first-party plugins; small runtime footprint.
- Rust >= 1.77.2: trusted core for IO/indexing — required baseline for Tauri v2 plugin ecosystem; good fit for local-first invariants.
- React 19.x: UI framework — strong ecosystem for editor UX, keyboard-first navigation.
- TypeScript 5.9.x: type safety — helps keep command/event contracts stable.
- Vite 7.3.x: tooling — de facto standard for Tauri web UI build/HMR.
- SQLite (FTS5): embedded index DB — proven full-text search and derived data storage in a single local file.

**Version notes:** align `tauri@2.9.x` with `tauri-plugin-dialog@2.6.x`; set MSRV to Rust >= 1.77.2.

### Expected Features

The product must feel like a “real” local-first notes app (workspace folder, CRUD, keyboard navigation, fast search) while proving the differentiator: aggregated todos from Markdown checkboxes that can be toggled and written back into the source note safely.

**Must have (table stakes):**
- Workspace folder open + workspace slots — file-first ownership and fast switching.
- Note lifecycle: create/rename/move/delete (soft delete/trash) — baseline desktop expectations.
- Edit-only Markdown editor with autosave + undo/redo — trust and daily usability.
- Fast incremental search across titles + bodies — instant navigation at scale.
- Keyboard-first navigation (overview/editor/todos) — command palette / predictable shortcuts.
- Tags (sidecar or inline) + filter — minimal organization and views.
- Todo extraction (`- [ ]` / `- [x]`) + aggregated todo list — core promise.
- Toggle todo updates the source note — the differentiator must be reliable.

**Should have (competitive):**
- Saved task views (saved filters) — GTD-like workflows without becoming a full task app.
- Meeting-note templates (agenda/notes/actions) — reinforces “meeting protocols” positioning.
- Search operators (path/tag/status) — makes larger vaults manageable.
- Global quick capture (hotkey) — macOS keyboard-first differentiation.

**Defer (v2+):**
- Task metadata (due/recurring/priority) — large scope increase; only if validated.
- Backlinks/wikilinks — only if it strengthens positioning beyond todos.
- Integrations (Reminders/Things) + plugin hooks — stability and API commitments; defer.

### Architecture Approach

The maintainable architecture is: UI as a client, Rust core as the domain owner. UI calls Tauri commands for user actions and subscribes to core-emitted events for index progress and invalidations; the core runs a single derivation pipeline (scan -> parse -> upsert/remove) and treats Markdown + sidecars as the only authoritative data.

**Major components:**
1. Core (Rust services) — workspace open/switch, note IO, metadata IO, indexing, search, todo extraction/toggle.
2. Indexing pipeline + derived store — inventory diff, SQLite FTS5 + todo cache under `.ponder/` with explicit rebuild.
3. File watcher + reconcile loop — debounced, best-effort hints feeding the pipeline; bulk-change mode.
4. Web UI (TS) + stores — overview list/search, editor, todos screen; keyboard-first focus/keymap.
5. Tauri bridge — typed commands + versioned event payloads.

### Critical Pitfalls

1. **Unsafe writes (autosave + toggles + external edits)** — use atomic write strategy, compare fingerprints to detect conflicts, preserve both versions, and re-validate targets before applying in-source toggles.
2. **Watcher events treated as truth** — treat events as hints; debounce and reconcile by stat/read/derive; support bulk rescan and manual reindex.
3. **Index drift (derived data diverges)** — single canonical pipeline, transactional updates, per-note fingerprints, and first-class repair actions (`reindex file/workspace`).
4. **Todo mis-parsing / corrupt toggles** — avoid regex-only approaches; prefer AST-aware parsing for task list items; golden tests for tricky Markdown; toggles must be minimal and idempotent.
5. **Workspace boundary + permissions issues** — strict root boundary (symlink policy), ignore noise directories, and clear UI/diagnostics for permission/watcher health (especially after restart).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Workspace Foundation + Identity
**Rationale:** Everything (IO, indexing, watcher correctness, sidecars) depends on a stable workspace model and note identity.
**Delivers:** Workspace open/switch (slots), folder picker, `.ponder/` + `deleted/` layout, canonical path rules, NoteId = filename stem (ms timestamp).
**Addresses:** Workspace-backed notes; workspace switching.
**Avoids:** Workspace boundary escapes; macOS permission/sandbox “works once then fails”.

### Phase 2: Safe Note IO + Sidecar Metadata
**Rationale:** Trust hinges on safe writes before adding background indexing or in-source mutations.
**Delivers:** Read/write/move/delete note operations in Rust; atomic writes; conflict detection via fingerprints; sidecar schema (`title`, `created_at`, optional `updated_at`, `tags`) with safe updates; soft delete to `deleted/`.
**Addresses:** Editor autosave prerequisites; tag field source; soft delete.
**Avoids:** Data loss from unsafe writes; partial reads mid-write (via your own atomic writes + retry strategy).

### Phase 3: Scanner + Canonical Derivation Pipeline (No Watcher Yet)
**Rationale:** A single derivation pipeline is the backbone for search/todos; build it deterministically before adding async watcher complexity.
**Delivers:** Workspace scan (root only) -> NoteSummary list; per-note parse for title + checkbox todos; persisted derived store skeleton under `.ponder/` with explicit schema versioning and a “rebuild index” command.
**Uses:** Rust background worker (tokio), `.ponder/` layout, derived-store version markers.
**Avoids:** Index drift via multiple code paths; “looks indexed but isn’t” failures.

### Phase 4: Todos v1 (Aggregate + Toggle Writes Back)
**Rationale:** This is the differentiator; it depends on safe writes + a deterministic parser.
**Delivers:** Todo extraction into derived store; todos screen grouped/sorted per requirements; toggle action that patches the checkbox marker in-source, re-validates preconditions, and re-derives note state after write.
**Addresses:** Todo extraction; todo list screen; toggle updates source; `o ` -> `[ ] ` conversion on leaving a note.
**Avoids:** Todo parse/toggle corruption; silent overwrite during toggle.

### Phase 5: Persistent Search (SQLite FTS5) + Overview UX
**Rationale:** “Type to filter” must be instant; FTS5 enables scalable search without UI stalls.
**Delivers:** `.ponder/index.sqlite` with FTS5 for title/body; query command returning ranked note IDs; overview integrates search + tag filter; index freshness/progress events.
**Uses:** SQLite FTS5 (rusqlite), commands/events pattern.
**Avoids:** Linear-scan search jank; indexing drift (transactional upserts).

### Phase 6: File Watcher + Reconcile + Bulk Ops Resilience
**Rationale:** External edits are table stakes; watcher correctness requires the pipeline from earlier phases.
**Delivers:** Debounced watcher (notify) feeding reconcile (inventory diff + stability reads); bulk change mode with progress/cancel; periodic lightweight rescan; clear “workspace health” (permissions, watcher status, last indexed).
**Addresses:** External edits; index stays consistent; recoverability.
**Avoids:** Watcher unreliability, event storms, partial reads mid-write, stale search/todos.

### Phase 7: Hardening + Performance + Security Baselines
**Rationale:** After core loops work, harden for trust and scale.
**Delivers:** Golden test suite for parsing/toggles; stress tests (bulk changes, 10k notes); index integrity checks + auto-repair flows; markdown rendering security decisions (even if preview is out of scope, any HTML rendering later must be sanitized).
**Addresses:** Reliability/recoverability; performance traps.
**Avoids:** “Looks done but isn’t” gaps; WebView content security issues.

### Phase Ordering Rationale

- Build safe IO + identity first so indexing/toggles can be correct and recoverable.
- Centralize derivation (scan/parse/upsert) before watcher integration to prevent drift from multiple update paths.
- Ship todos before “nice-to-have” meeting templates/saved views; validate the core promise early.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** Markdown task parsing + stable todo identity + minimal patching strategy (AST vs constrained line matcher; test matrix).
- **Phase 6:** macOS watcher behavior under real editors + bulk ops; debouncing/backpressure strategies; permission persistence depending on distribution/sandboxing.

Phases with standard patterns (skip research-phase):
- **Phase 5:** SQLite FTS5-backed local search (well-documented, proven pattern).
- **Phase 2:** Atomic write + fingerprint conflict detection patterns (well-understood, testable).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tauri/SQLite/notify versions and constraints are backed by official docs and crate docs; guidance is concrete. |
| Features | MEDIUM | Strong table-stakes consensus + clear MVP definition, but prioritization beyond v1 depends on user validation. |
| Architecture | MEDIUM | Standard Tauri “UI client + Rust core” patterns; details (exact module boundaries, index schema) still need implementation choices. |
| Pitfalls | HIGH | Known failure modes for local-first editors; mitigations are concrete and map cleanly to phases. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Markdown parser choice for todos/toggling:** research flags AST-based parsing but does not pick a specific Rust parser/library; decide and lock this early in Phase 4 with golden tests.
- **Note identity vs rename/move semantics:** current project decision is stem-based identity (timestamp filename) and root-only notes; if move/rename across folders is introduced later, re-evaluate sidecar association strategy and move detection.
- **Distribution model (sandboxing/signing/notarization):** permission persistence and watcher visibility differ; decide before wider beta distribution.
- **Index schema details:** tags filtering can start as post-filtering, but a `note_tags` table may be needed for fast operators later; decide once real vault size/usage is known.

## Sources

### Primary (HIGH confidence)
- https://tauri.app/ — Tauri v2 docs (capabilities/plugins/distribution)
- https://docs.rs/tauri/2.9.5/tauri/ — Tauri crate requirements and API surface
- https://v2.tauri.app/reference/acl/capability/ — Tauri capability model context
- https://www.sqlite.org/fts5.html — SQLite FTS5 reference
- https://docs.rs/notify/latest/notify/ — notify watcher behavior/limitations
- https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/Introduction/Introduction.html — FSEvents overview
- https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/FileSystemEventSecurity/FileSystemEventSecurity.html — FSEvents security/visibility notes

### Secondary (MEDIUM confidence)
- https://codemirror.net/6/ — CodeMirror 6 editor overview
- https://bear.app/faq/ — Bear feature surface (tags/search/backlinks/shortcuts)
- https://noteplan.co/ and https://help.noteplan.co/ — NotePlan positioning and linking concepts
- https://github.com/obsidian-tasks-group/obsidian-tasks — task query/toggle behavior reference

---
*Research completed: 2026-01-30*
*Ready for roadmap: yes*
