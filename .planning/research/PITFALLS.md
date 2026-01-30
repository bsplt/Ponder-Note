# Pitfalls Research

**Domain:** macOS desktop app editing local Markdown with derived indexes (search, todos, tags)
**Researched:** 2026-01-30
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Treating filesystem events as a reliable source of truth

**What goes wrong:**
The app misses changes, processes the same change multiple times, or processes changes out of order. Indexing becomes stale or “flaps” (content appears/disappears). External edits (VS Code, Obsidian, git checkout) behave unpredictably.

**Why it happens:**
Filesystem watchers are best-effort. Editors save files via rename/replace, truncate+rewrite, temp files, and bursts of operations. On macOS, event visibility can also be affected by ownership/permissions.

**How to avoid:**
- Treat watch events as hints, not authoritative.
- Build a reconcile loop: on event(s) for a path, re-stat and (if needed) re-read the file and re-derive state.
- Coalesce and debounce changes (per-path queue; batch windows).
- Prefer “eventual correctness” over “exact event fidelity”: periodic lightweight rescan of workspace; manual “Reindex” action.
- Design for rename/move as first-class: handle delete+create pairs as potential rename.

**Warning signs:**
- “Search doesn’t find a note I just edited” or “todo list doesn’t update until restart.”
- Index changes differ depending on editor.
- Large ops (git checkout, moving folders) cause long UI hangs or missed updates.

**Phase to address:**
Phase 4 (Watcher & sync pipeline) with enabling groundwork in Phase 1 (workspace scanning model).

---

### Pitfall 2: Indexing drift (derived indexes silently diverge from source files)

**What goes wrong:**
Search results, tag lists, and extracted todos no longer match actual Markdown content. Users lose trust because the UI shows “facts” that are wrong.

**Why it happens:**
Derived data is computed in multiple places, updates are dropped under load, and there’s no systematic verification of index correctness. It’s easy to ship “incremental indexing” without robust invariants.

**How to avoid:**
- Define a single canonical derivation pipeline (parse -> extract -> persist).
- Store a per-file fingerprint in the index (at minimum: size + mtime; ideally: content hash) and verify at query/open time.
- Make indexing transactional: write derived rows in one transaction; never partially update (e.g., update todos but not search).
- Provide explicit repair paths: “Reindex file” and “Reindex workspace,” plus an automatic periodic reconciliation mode.
- Add correctness tests using fixtures: Markdown in, extracted todos/tags/outlines expected (golden tests).

**Warning signs:**
- Bug reports that “fix themselves” after “Reindex” or restart.
- UI shows old tags/todos after edits.
- Inconsistent behavior between search view and note view.

**Phase to address:**
Phase 3 (Indexing v1 + invariants) and continuously verified in Phase 5 (search UX verification).

---

### Pitfall 3: Data loss from unsafe writes (autosave + in-source edits + external edits)

**What goes wrong:**
Edits disappear, are partially written, or overwrite changes made by another editor. Crashes during write can corrupt files. In-source todo toggles can clobber nearby content.

**Why it happens:**
“Just write the file” ignores atomicity, concurrency, and crash safety. Autosave makes writes frequent, increasing the chance of race conditions.

**How to avoid:**
- Use atomic write strategy (write temp, fsync, rename) so readers never see partial content.
- Detect write conflicts: when saving, compare the file’s last-seen fingerprint against current fingerprint; if changed, do not overwrite silently.
- Provide conflict handling: keep both versions (e.g., create `filename (conflict).md`), or show a diff/merge UI.
- Make “in-source mutations” (todo toggle) operate on a fresh snapshot, and re-validate the target still matches before applying.
- Implement local history for safety (lightweight per-file versions) so recovery is possible even after user mistakes.

**Warning signs:**
- Reports of “I toggled a task and the paragraph changed.”
- User sees conflicts when using git or iCloud/Dropbox.
- Rare corrupt/empty files after crash.

**Phase to address:**
Phase 2 (Editor core: autosave, conflict detection, safe writes) and Phase 7 (history/recovery).

---

### Pitfall 4: Mis-parsing Markdown for todos (false positives/negatives + corrupt edits)

**What goes wrong:**
Todo extraction captures checkboxes inside code blocks, blockquotes, tables, or frontmatter incorrectly. Toggling tasks breaks list indentation, numbering, or formatting. IDs/anchors used for task identity shift unpredictably.

**Why it happens:**
Regex-based parsing is tempting, but Markdown edge cases are endless. “Toggle in-source” requires stable mapping from a UI item to a precise byte/line range.

**How to avoid:**
- Use a Markdown parser/AST and operate only on valid task list items.
- Introduce a stable task identity strategy (e.g., per-task generated IDs stored as HTML comments, or a deterministic hash of a normalized node) and define how it behaves when users edit surrounding text.
- Make toggling idempotent and minimal: only flip the `[ ]`/`[x]` marker and preserve whitespace.
- Golden tests for extraction and toggling (before/after files) across tricky Markdown cases.

**Warning signs:**
- Tasks appear/disappear depending on formatting.
- Toggling a task changes unrelated lines.
- Repeated toggles “drift” formatting.

**Phase to address:**
Phase 6 (Tasks/todos) but parser selection + test harness should start in Phase 3.

---

### Pitfall 5: Tag sidecars drift (renames/moves break metadata)

**What goes wrong:**
Sidecar tags get orphaned when files are renamed/moved; tags appear to “reset” or attach to the wrong note. Merge conflicts in sidecars are common.

**Why it happens:**
Path-based identity is brittle. “Note identity” must survive rename/move, but the filesystem’s primary identifier for humans is the path.

**How to avoid:**
- Decide and document the identity model early:
  - If you keep tags in sidecars, bind them to a stable file identity (not just path). On macOS that might mean tracking inode + volume id (but this has edge cases) or storing a generated UUID inside the note/frontmatter.
  - Alternatively: prefer storing tags in-note (frontmatter) and treat sidecars as cache.
- Ensure rename/move is processed as a move (not delete+create). When in doubt, match content hashes to detect moves.
- Provide a “repair” tool: find orphan sidecars, propose re-association.

**Warning signs:**
- Tags disappear after reorganizing folders.
- Same note shows different tags depending on how it was opened.
- Users report “duplicate tags files” or unresolved merge conflicts.

**Phase to address:**
Phase 6 (Tags) with prerequisite move/rename handling in Phase 4.

---

### Pitfall 6: Reading files mid-write (partial reads cause parse/index corruption)

**What goes wrong:**
Indexer reads a file while another editor is saving it, resulting in truncated content, invalid UTF-8, or partial frontmatter. Derived indexes temporarily become wrong.

**Why it happens:**
Watch events often fire during intermediate states (truncate, temp write, rename). A naive indexer will read on the first event.

**How to avoid:**
- Implement “stability reads”: after a change, wait for file size/mtime to stabilize across a short window before reading.
- Retry on parse failure with backoff.
- Prefer atomic save strategy in your own editor to avoid producing partial states.
- Treat indexing failures as non-fatal: keep last good derived data until new derivation succeeds.

**Warning signs:**
- Random parse errors that go away on retry.
- Brief flashes of empty content in UI.
- Index shows temporarily missing tags/todos.

**Phase to address:**
Phase 4 (Watcher pipeline) and Phase 3 (indexer robustness).

---

### Pitfall 7: Event storms and large vaults (watcher/indexer overload)

**What goes wrong:**
Large repositories or bulk operations (git checkout, unzip, move folder) produce thousands of events; the app pegs CPU, becomes unresponsive, or drops events leading to drift.

**Why it happens:**
Event-driven systems without backpressure assume a low event rate. Real user workflows violate this assumption.

**How to avoid:**
- Use a bounded queue with backpressure, and switch modes under load (e.g., “bulk change detected: running rescan”).
- Batch processing: coalesce events for the same subtree.
- Keep indexing off the UI thread; show progress + allow cancel.
- Make search/index availability explicit during rebuild.

**Warning signs:**
- CPU spikes during git operations.
- App becomes laggy after moving folders.
- “I had to restart to make it normal again.”

**Phase to address:**
Phase 4 (watcher) and Phase 8 (performance profiling + tuning).

---

### Pitfall 8: Workspace boundary bugs (symlinks, aliases, and path escapes)

**What goes wrong:**
The scanner follows symlinks out of the workspace, indexes unintended files, loops infinitely, or hits massive directories. Security-wise, the app may inadvertently read sensitive files.

**Why it happens:**
Recursive traversal is deceptively simple. macOS users often have symlinks, iCloud, and “clever” folder structures.

**How to avoid:**
- Canonicalize and enforce a strict “workspace root” boundary.
- Decide symlink policy explicitly (default: do not follow symlinks when scanning/indexing; allow opt-in with clear UI).
- Detect loops (visited inode set) and enforce maximum depth / file count safety limits.
- Ignore known noise paths (`.git/`, build artifacts) via defaults + user config.

**Warning signs:**
- Index unexpectedly includes files outside the chosen folder.
- Indexing never finishes on certain workspaces.
- Huge disk activity or memory use after selecting a workspace.

**Phase to address:**
Phase 1 (Workspace foundation) and re-verified in Phase 3 (indexer).

---

### Pitfall 9: macOS permission/sandbox pitfalls (can’t read/watch after restart)

**What goes wrong:**
App can open a folder once but fails after restart; watcher fails silently; indexing errors occur only on some directories.

**Why it happens:**
macOS permission models (and app sandboxing, if enabled) require correct, persistent permission grants. Watchers can also have visibility limits depending on ownership and permissions.

**How to avoid:**
- Use OS-native folder selection flows and persist access appropriately for your distribution model.
- Detect permission errors distinctly (not as “file not found”) and guide the user to fix them.
- Maintain a clear “workspace health” panel: read/write permission, watcher status, last indexed time.

**Warning signs:**
- “Works on my machine” but fails for beta users.
- After restart: empty workspace or stale index.
- Logs show permission errors but UI doesn’t.

**Phase to address:**
Phase 1 (Workspace selection + permissions) and Phase 4 (watcher error handling).

---

### Pitfall 10: Unsafe Markdown rendering inside a WebView (local content XSS / resource leaks)

**What goes wrong:**
Notes containing raw HTML/JS (or embedded remote resources) can execute code inside the app’s WebView context, leak local paths, or open unexpected network requests.

**Why it happens:**
Rendering Markdown in a WebView feels “local and safe,” but it’s still an HTML execution environment.

**How to avoid:**
- Sanitize rendered HTML (disallow scripts; restrict dangerous attributes).
- Control URL handling: limit `file:`/custom protocol exposure; guard against path traversal in resource resolvers.
- Make remote images/links explicit (opt-in) to avoid silent network fetch.

**Warning signs:**
- Notes can inject unexpected UI.
- Network requests occur when opening notes.
- Security reviews flag WebView as high risk.

**Phase to address:**
Phase 2 (Editor/viewer security baseline) and revisited in Phase 8 (hardening).

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `path` as the only note ID | Easy to implement | Breaks rename/move, sidecars drift, lost history | Only for a throwaway prototype |
| Use only `mtime` to detect changes | Fast | Misses changes with coarse timestamps; drift | Maybe in MVP if combined with periodic full reconcile |
| Index on every keystroke synchronously | Simple mental model | UI jank, battery drain | Never (always background + debounce) |
| Regex-based Markdown parsing for tasks | Quick wins | Edge cases, corrupt toggles | Only for read-only extraction demo |
| Store derived indexes as ad-hoc JSON files | Transparent | Corruption, slow queries, hard migrations | MVP only, if rebuild is fast and verified |

## Integration Gotchas

Common mistakes when interacting with the broader local-files ecosystem.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| External editors (VS Code, Obsidian) | Assume “save” is a simple write | Handle replace/rename saves; reconcile by re-stat/re-read |
| Git workflows | Treat checkout/rebase as normal edits | Detect bulk change bursts; rescan mode + progress |
| Cloud drives (iCloud/Dropbox) | Assume stable event delivery | Be robust to missing events and temporary placeholder files; prefer reconcile |
| OS permissions | Assume folder access is permanent | Persist access correctly; surface permission health |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full reindex on startup every time | Slow launch, fans spin | Incremental index + fingerprint checks | ~1k+ notes or slow disks |
| Rendering or parsing Markdown on main/UI thread | Typing lag, scroll stutter | Background parse; cache AST/derived view | Immediately noticeable on mid-sized notes |
| Search without an index (linear scan) | Search takes seconds | Use real full-text index + incremental updates | ~5k+ files or frequent searches |
| Eagerly computing derived views (todos/tags) for whole vault | Battery drain | Lazy compute + precompute in background with throttling | Always, but worse with big vaults |

## Security Mistakes

Domain-specific issues beyond generic “web app” security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Following symlinks outside workspace by default | Inadvertently reads sensitive files | Default no-follow; strict root boundary |
| Allowing Markdown HTML/JS execution | Code execution in WebView context | Sanitize; block scripts; strict URL handling |
| Writing outside workspace due to path bugs | Data loss / overwrite | Canonicalize; enforce root; treat all paths as untrusted input |

## UX Pitfalls

Common user experience mistakes in keyboard-first, local-first editors.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visible indexing status | “Search is broken” perception | Show index freshness, progress, and a one-click “Reindex” |
| Silent conflict overwrites | Trust loss, data loss | Detect conflicts; preserve both; clear UI and undo |
| Soft delete without obvious recovery | Fear of using delete | Provide “Trash” with restore + retention policy |
| Keyboard shortcuts are inconsistent across views | Slows power users | Define global keymap + command palette + discoverability |
| Todo toggles don’t match what user sees | Confusion | Toggle acts only on valid task items; show exact source change |

## "Looks Done But Isn't" Checklist

- [ ] **Watcher integration:** Verified across different editors (replace-save, truncate-save) and bulk ops (git checkout)
- [ ] **Index correctness:** “Reindex workspace” exists; fingerprints prevent drift; index freshness is visible
- [ ] **Autosave safety:** Atomic writes; conflict detection; crash does not corrupt files
- [ ] **Todo toggle:** Golden tests cover lists, nested lists, code blocks, frontmatter
- [ ] **Soft delete:** Restore flow exists; delete never permanently destroys without user intent

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Watcher missed events / drift | LOW | Run reconcile scan; “Reindex workspace”; restart watcher |
| Index corruption | MEDIUM | Drop/rebuild index database; keep sources untouched; verify via fingerprints |
| User-visible data loss from overwrite | HIGH | Restore from local history/backups; keep conflict copies; provide diff recovery |
| Sidecar/tag drift | MEDIUM | Run orphan repair tool; re-associate via content hash; optionally migrate tags into frontmatter |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Filesystem events aren’t reliable | Phase 4 | Bulk ops + external editor test suite; periodic reconcile proves eventual correctness |
| Indexing drift | Phase 3 | Fingerprint mismatch detection; “reindex file/workspace” fixes without data loss |
| Unsafe writes / data loss | Phase 2 | Crash test during save; conflict simulation; file never ends up empty/corrupt |
| Todo parse/toggle corruption | Phase 6 | Golden tests; property tests for idempotence; manual QA on tricky notes |
| Sidecar tags drift | Phase 6 | Rename/move test matrix; orphan detection; tag state survives reorganizing |
| Partial reads mid-write | Phase 4 | Simulated truncate/replace saves; indexer retries and stabilizes |
| Event storms / overload | Phase 4 | Stress test on 10k+ files; backpressure switches to rescan without UI hang |
| Workspace boundary escapes | Phase 1 | Symlink loop tests; canonical root enforcement; ignores .git by default |
| macOS permission/sandbox failure | Phase 1 | Restart persistence test; clear UI for missing permissions |
| Unsafe Markdown rendering | Phase 2 | Sanitization tests; no script execution; controlled link/resource policy |

## Sources

- Rust `notify` crate documentation (known problems: editor behavior, large dirs, macOS FSEvents visibility): https://docs.rs/notify/latest/notify/
- Apple Documentation Archive: File System Events Programming Guide (intro): https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/Introduction/Introduction.html
- Apple Documentation Archive: File System Event Security: https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/FileSystemEventSecurity/FileSystemEventSecurity.html
- Tauri 2.0 docs (security/capabilities model context): https://v2.tauri.app/reference/acl/capability/

---
*Pitfalls research for: Ponder (macOS local-first Markdown workspace with derived indexes)*
*Researched: 2026-01-30*
