---
phase: 02-note-identity-&-sidecar-metadata
plan: 01
subsystem: domain
tags:
  - rust
  - tauri
  - markdown
  - metadata
depends:
  requires: []
  provides:
    - note title derivation helper
    - title normalization tests
  affects:
    - 02-02-PLAN.md
    - 02-03-PLAN.md
tech-stack:
  added: []
  patterns:
    - string normalization helpers
    - table-driven tests
key-files:
  created:
    - app/src-tauri/src/domain/note_title.rs
  modified:
    - app/src-tauri/src/domain/mod.rs
decisions: []
metrics:
  duration: "4m 9s"
  completed: "2026-01-31"
---

# Phase 02 Plan 01: Title Derivation Utility Summary

Deterministic markdown title derivation with rule-coverage tests.

## Work Completed

- Implemented `derive_note_title` with ordered markdown normalization and prefix stripping.
- Added a focused table-driven test suite covering headings, lists, checkboxes, links, and formatting.
- Exported the new domain module for reuse in upcoming metadata work.

## Tests

- `nix --extra-experimental-features "nix-command flakes" develop -c cargo test` (app/src-tauri)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Enabled Nix experimental features for tests**

- **Found during:** Task 1 verification
- **Issue:** `nix develop` failed with disabled `nix-command` and `flakes` features
- **Fix:** Ran tests with `nix --extra-experimental-features "nix-command flakes" develop -c cargo test`
- **Files modified:** None
- **Commit:** N/A

## Authentication Gates

None.

## Decisions Made

None.

## Next Phase Readiness

Ready to proceed with 02-02-PLAN.md.
