# Architecture Research

**Domain:** Tauri desktop app managing local Markdown notes (workspace folder)
**Researched:** 2026-01-30
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

The common, maintainable shape for a “local files as source-of-truth” desktop notes app is:

- Web UI owns interaction state and view composition.
- A Rust “core” owns all IO, indexing, and domain decisions (note identity, metadata rules, todo edits).
- Frontend talks to the core via request/response commands for user actions, and receives push events for background work (initial indexing, file watcher changes).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                               Web UI (TS)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Overview     │  │ Editor      │  │ Todo List   │  │ Workspace UI  │  │
│  │ (list+search)│  │ (autosave)  │  │ (toggle)    │  │ (slots/picker)│  │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────┬────────┘  │
│         │                 │                │                │           │
│     Stores/ViewModels (notes, filters, selection, todos, tags, status)  │
└─────────┬─────────────────┬─────────────────┬─────────────────┬─────────┘
          │ invoke(cmd)     │ invoke(cmd)     │ invoke(cmd)     │
          │ listen(events)  │ listen(events)  │ listen(events)  │
┌─────────┴───────────────────────────────────────────────────────────────┐
│                         Tauri Bridge (commands/events)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Commands: request/response for UI actions                              │
│  Events: push progress + invalidations + changed entities               │
└─────────┬───────────────────────────────────────────────────────────────┘
          │
┌─────────┴───────────────────────────────────────────────────────────────┐
│                               Core (Rust)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ WorkspaceSvc │  │ NotesSvc     │  │ TodosSvc      │  │ SearchSvc   │ │
│  │ (slots/open) │  │ (read/write) │  │ (extract/edit)│  │ (query)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  └──────┬──────┘ │
│         │                 │                 │                  │        │
│         └──────────────┬──┴──────────────┬──┴───────────────┬──┘        │
│                        │                 │                  │           │
│                Indexing Pipeline     File Watcher      Caches/Version   │
│               (scan->parse->upsert)  (debounced)      (rebuild triggers)│
└─────────┬───────────────────────────────────────────────────────────────┘
          │
┌─────────┴───────────────────────────────────────────────────────────────┐
│                           Storage (source/derived)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Source of truth:                                                       │
│   - <workspace>/*.md                                                    │
│   - <workspace>/.ponder/meta/<stem>.json                                │
│  Derived/rebuildable:                                                   │
│   - <workspace>/.ponder/index/* (FTS index, inventories, etc.)          │
│  Soft delete:                                                           │
│   - <workspace>/deleted/*.md                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component              | Responsibility                                           | Typical Implementation                                   |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Web UI Screens         | Overview/editor/todos flows + keyboard-first UX          | Router + components; minimal logic per screen            |
| UI Stores / ViewModels | Local state: selection, filters, optimistic UI           | Small reactive stores; updates driven by commands/events |
| Tauri Commands         | Deterministic “do X” entry points                        | `#[tauri::command]` functions calling services           |
| Tauri Events           | Push invalidations + progress from background work       | `emit`/`listen` event channel                            |
| WorkspaceService       | Active workspace slot, open/switch, path validation      | Reads/writes global config; canonicalize paths           |
| NotesService           | Read note summaries, load note text, write note (atomic) | FS repository + parser + meta updates                    |
| MetadataService        | Read/write `.ponder/meta/*.json` sidecars                | JSON schema versioning; safe concurrent writes           |
| IndexingPipeline       | Scan workspace, parse notes, update derived stores       | Change detector + background worker                      |
| SearchService          | Full-text queries + tag filter combination               | Derived index (recommended: SQLite FTS5)                 |
| TodosService           | Extract todos, group, toggle checkbox in-source          | Parser + patcher + post-write reindex                    |
| FileWatcher            | Detect external edits/moves/deletes and trigger reindex  | Debounced watcher (e.g., notify crate)                   |
| Derived Stores         | Inventory + search index + (optional) todo cache         | `.ponder/index/*` versioned artifacts                    |

## Recommended Project Structure

This keeps “domain core” in Rust (testable), and treats the web UI as a client.

```
src-tauri/
├── src/
│   ├── main.rs                 # Tauri setup; command/event wiring
│   ├── app_state.rs             # Shared state (active workspace, handles)
│   ├── commands/                # Thin Tauri command handlers
│   ├── events/                  # Event names + payload structs
│   ├── domain/                  # Pure types: NoteId, NoteSummary, Tag, Todo
│   ├── services/                # Workspace/Notes/Meta/Search/Todos orchestration
│   ├── storage/
│   │   ├── fs_repo.rs           # Read/write/move notes; atomic write helpers
│   │   ├── meta_repo.rs         # Sidecar JSON read/write
│   │   └── index_repo.rs        # Derived index storage (sqlite/dirs)
│   ├── indexing/
│   │   ├── scanner.rs           # list .md, stat, diff vs inventory
│   │   ├── parser.rs            # title/todos extraction
│   │   └── pipeline.rs          # upsert/remove into derived stores
│   └── watcher/                 # Debounced filesystem watcher
└── tauri.conf.json

src/
├── app/                         # app shell + routing
├── screens/                     # Overview, Editor, Todos
├── components/                  # list, preview, tag input, etc.
├── stores/                      # notes store, tags store, todos store
├── api/                         # typed wrappers around invoke + event subscriptions
└── styles/                      # CSS-first styling
```

### Structure Rationale

- **src-tauri/src/domain/:** Stable, reusable domain types shared across services; keeps UI from inventing its own schemas.
- **src-tauri/src/services/:** Owns business rules (source-of-truth, sidecars, delete semantics, rebuild behavior).
- **src-tauri/src/storage/:** IO boundaries; mockable in tests; prevents “logic in the filesystem layer”.
- **src-tauri/src/indexing/:** A pipeline you can run at startup, after edits, and during “rebuild”.
- **src/api/:** Single typed entry for UI-to-core calls; avoid scattering raw command names across components.

## Architectural Patterns

### Pattern 1: Commands for user intent, Events for background invalidation

**What:** UI uses commands for “do a thing now” and listens for events for “something changed” (index progress, file changed externally).
**When to use:** Always in Tauri apps where background work updates UI.
**Trade-offs:** Events require careful payload/versioning; commands can become chatty if too granular.

**Example:**

```typescript
// ui/api/notes.ts
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

export async function openNote(noteId: string) {
  return invoke<string>("notes_open", { noteId });
}

export async function onIndexProgress(
  cb: (p: { done: number; total: number }) => void,
) {
  return listen("index/progress", (event) => cb(event.payload as any));
}
```

### Pattern 2: “Source-of-truth vs derived data” separation (and explicit rebuild)

**What:** Treat Markdown + sidecars as authoritative; everything else can be deleted and rebuilt.
**When to use:** Always for local-file apps; it prevents schema migrations from bricking user data.
**Trade-offs:** Rebuild must be fast enough; derived stores need versioning + corruption recovery.

Implementation recommendations:

- Authoritative:
  - Markdown file: content + todos.
  - Sidecar JSON: tags + cached timestamps (and required `title`/`created_at` per project constraints).
- Derived:
  - Inventory table: `path`, `stem`, `mtime`, `size`, optional `content_hash`.
  - Search index: full-text index of note text (and optionally title/tags).
  - Todo cache (optional): extracted todos so todo view is instant; still re-verified on toggle.

Rebuild triggers (treat as “drop derived + rescan”):

- Derived schema version mismatch (app upgrade changes indexing schema).
- Index corruption / failed integrity check.
- User manual “Rebuild Index” action.
- Workspace root changed.

### Pattern 3: Incremental indexing via an inventory diff

**What:** Keep a lightweight inventory of known notes; on startup and on file events, compute diffs (added/changed/deleted) then update derived stores.
**When to use:** As soon as search and todos depend on more than a handful of notes.
**Trade-offs:** Requires robust “what changed?” logic; hashing full content is expensive.

Suggested diff algorithm (fast-first):

1. List `<workspace>/*.md` (exclude `deleted/` and `.ponder/`).
2. For each file, stat (`mtime`, `size`).
3. If new or (mtime,size) changed -> parse + upsert.
4. If missing -> remove from derived stores.
5. Optionally compute content hash only when (mtime,size) changed but you need to avoid false positives.

## Data Flow

### Request Flow

```
[User types in overview search]
  ↓
UI Store updates query
  ↓
invoke(search_query)
  ↓
SearchService -> IndexRepo (FTS)
  ↓
result: [noteIds]
  ↓
UI merges noteIds with cached NoteSummary list -> renders
```

### State Management

```
Core emits events: index/progress, notes/changed, todos/changed
  ↓ (subscribe)
UI Stores update normalized caches (notesById, todosById, tagSet)
  ↓
Screens derive view state (filters + selection)
```

### Key Data Flows

1. **Workspace open / startup index**

```
UI: select slot/open workspace
  ↓ invoke(workspace_open)
Core: validate path -> ensure .ponder/ layout -> start indexing pipeline
  ↓ emit(index/progress)
Core: upsert NoteSummary + tags + todos + search index
  ↓ emit(index/ready)
UI: render overview from NoteSummary list
```

2. **Editor autosave**

```
UI: editor debounce fires
  ↓ invoke(notes_save{noteId, content})
Core: atomic write <workspace>/<stem>.md
  ↓
Core: re-parse title/todos -> write sidecar updated_at/title/tags (if needed)
  ↓
Core: update derived stores (FTS + todo cache) incrementally
  ↓ emit(notes/changed{noteId}) + emit(todos/changed{noteId})
UI: overview + todo list reflect changes
```

3. **Todo toggle (single source of truth = markdown)**

```
UI: click todo
  ↓ invoke(todos_toggle{noteId, todoKey})
Core: patch markdown checkbox in-place (or rewrite file)
  ↓
Core: update sidecar updated_at
  ↓
Core: update todo cache + FTS index for that note
  ↓ emit(todos/changed{noteId})
```

4. **Soft delete (move to deleted/)**

```
UI: press d then d
  ↓ invoke(notes_soft_delete{noteId})
Core: move <workspace>/<stem>.md -> <workspace>/deleted/<stem>.md
  ↓
Core: remove from derived stores (inventory, search index, todo cache)
  ↓ emit(notes/removed{noteId})
```

## Caching / Indexing Guidance (where + how)

### Where to put caches

- Put all rebuildable artifacts under `<workspace>/.ponder/`.
- Keep a single “schema version” marker (file or DB pragma) so rebuild triggers are explicit.

Recommended layout (derived/rebuildable):

```
<workspace>/.ponder/
├── index/
│   ├── search.sqlite          # FTS index + inventory tables (recommended)
│   └── version.json           # { schema_version, app_version, created_at }
└── meta/
    └── <stem>.json            # authoritative tags + timestamps
```

### How to rebuild

- “Rebuild” should be a first-class operation: stop watcher, delete `.ponder/index/`, rescan workspace, recreate index, restart watcher.
- Rebuild should be safe to run at any time (idempotent) and should not touch Markdown or meta sidecars.

### Indexing backend recommendation

- **Recommended:** SQLite FTS5 as embedded full-text index (simple, proven, single file). FTS5 is designed for full-text search over document sets and supports MATCH queries and relevance ranking. (SQLite FTS5 docs: https://www.sqlite.org/fts5.html)
- **Alternative (when FTS needs are richer):** a dedicated Rust full-text engine (e.g., Tantivy) stored under `.ponder/index/` (LOW confidence here; not verified in this research run).

### File watching recommendation

- Use a filesystem watcher in Rust, debounce bursts, and treat events as “invalidate and rescan” rather than trying to perfectly interpret every low-level event.
- notify is a widely-used Rust watcher library and supports macOS via FSEvents/kqueue, plus debouncer helpers. (notify repo: https://github.com/notify-rs/notify)

## Suggested Build Order (roadmap implications)

This is ordered to reduce rewrites: establish identities + IO rules first, then derived features (todos/search) that depend on stable parsing + write paths.

1. **Workspace + note identity foundation**
   - Workspace slots config, open/switch, ensure folder layout (`.ponder/`, `deleted/`).
   - NoteId model = filename stem (ms timestamp) + relative path rules.
   - Safe filesystem layer (atomic writes, move to deleted).

2. **Metadata sidecars (authoritative tags/timestamps)**
   - Sidecar schema + read/write; guarantee required fields (`title`, `created_at`).
   - Tag autocomplete needs a canonical “tag set” builder from sidecars.

3. **Workspace scan -> note summaries (no search index yet)**
   - Scanner lists notes and produces `NoteSummary` (title from first line, created_at from stem, tags from sidecar).
   - Overview can ship with basic list + tag filter (even if search is naive at first).

4. **Editor read/write with autosave (and consistency rules)**
   - Open note, edit, autosave.
   - On save: update sidecar `updated_at` and recompute `title` (since `title` is required in sidecar).
   - Emit `notes/changed` events.

5. **Todo extraction + toggle in-source**
   - Implement parser for markdown checkboxes and a stable todo key (e.g., noteId + line index + text hash).
   - Toggling must patch markdown safely and then re-run the per-note parse.

6. **Persistent full-text search index + incremental indexing**
   - Start with a full rebuild on app start (acceptable for small workspaces).
   - Add inventory diff + incremental update so edits don’t require full rescan.
   - Integrate tag filter as either:
     - post-filtering in UI on returned noteIds, or
     - a metadata table join (if using SQLite).

7. **File watcher + resilience polish**
   - Watch workspace for external changes; trigger incremental reindex.
   - Add index rebuild triggers and a manual “Rebuild index” command.
   - Handle edge cases: partial writes, rapid edits, move-to-deleted, missing sidecars.

## Scaling Considerations

| Scale        | Architecture Adjustments                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 0-1k notes   | Full startup scan + rebuild-on-change is fine; keep UI responsive via background tasks + progress events                          |
| 1k-20k notes | Persistent FTS + inventory diff; debounce watcher; avoid reading full file for list view                                          |
| 20k+ notes   | Strongly prefer incremental indexing + paging/virtualized UI list; consider more advanced index engine if SQLite becomes limiting |

### Scaling Priorities

1. **First bottleneck:** full-text search latency -> persistent FTS index + incremental updates.
2. **Second bottleneck:** initial scan time -> inventory diff + parallel parsing (bounded concurrency) and progress UI.

## Anti-Patterns

### Anti-Pattern 1: UI reads/writes the filesystem directly

**What people do:** Use JS filesystem APIs (or plugins) from the webview and bypass Rust.
**Why it's wrong:** Splits source-of-truth logic across two languages, makes consistency (sidecars/index) hard, and increases security surface.
**Do this instead:** Route all IO through Rust services behind commands; UI only calls `invoke` and listens for events.

### Anti-Pattern 2: Treating derived index as authoritative

**What people do:** Store “the real tags/todos” only in the index DB.
**Why it's wrong:** Rebuild becomes destructive; external edits break invariants; users lose data if index corrupts.
**Do this instead:** Keep Markdown + sidecars authoritative; delete-and-rebuild derived index at any time.

### Anti-Pattern 3: Trying to interpret raw file watcher events as truth

**What people do:** Assume a single FS event maps to a single semantic action (rename vs move vs write).
**Why it's wrong:** Platform watchers can coalesce, reorder, or omit events; editors often do “write temp + rename”.
**Do this instead:** Debounce to a short window and recompute diffs from inventory as the source of change truth.

## Integration Points

### External Services

| Service            | Integration Pattern            | Notes                                 |
| ------------------ | ------------------------------ | ------------------------------------- |
| OS folder picker   | Tauri dialog plugin / API      | Drives workspace slot selection       |
| Global config path | PlatformDirs / Tauri path APIs | Store `config.json` outside workspace |

### Internal Boundaries

| Boundary           | Communication                                   | Notes                                                  |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------ |
| UI ↔ Core          | Tauri commands + events                         | Commands for actions; events for progress/invalidation |
| Services ↔ Storage | Trait-based repos                               | Enables tests; prevents leaking FS concerns            |
| Indexing ↔ UI      | Events + idempotent “get latest state” commands | UI should tolerate missing/out-of-order events         |

## Sources

- Tauri v1 docs (commands, event channel concepts):
  - https://v1.tauri.app/v1/guides/features/command
  - https://v1.tauri.app/v1/guides/features/events
- Tauri v2 docs entrypoint (current docs hub): https://tauri.app/
- SQLite FTS5 (embedded full-text search): https://www.sqlite.org/fts5.html
- notify (Rust filesystem watching; macOS via FSEvents/kqueue): https://github.com/notify-rs/notify

---

_Architecture research for: Tauri desktop app managing local Markdown notes_
_Researched: 2026-01-30_
