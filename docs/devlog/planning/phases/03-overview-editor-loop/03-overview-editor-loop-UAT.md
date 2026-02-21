---
phase: 03-overview-editor-loop
status: diagnosed
reported: 2026-01-31T00:00:00Z
source: manual-verification
gaps:
  - truth: "Edits autosave without error and update the last-saved timestamp"
    reason: "Autosave always surfaces the error banner: 'Autosave failed. Last saved: Not saved yet'"
    artifacts:
      - app/src/screens/Editor.tsx
      - app/src/api/notes.ts
      - app/src-tauri/src/commands/notes.rs
      - app/src-tauri/src/services/workspace_service.rs
    missing:
      - "Identify the note_save failure cause and fix it (surface actual error message during save attempts)."
      - "Ensure successful saves clear the banner and update lastSavedAt."
  - truth: "Exit saves (with checklist rewrite) succeed without prompting"
    reason: "Exit path always confirms: 'Latest save failed. Exit anyway? Unsaved changes may be lost.'"
    artifacts:
      - app/src/screens/Editor.tsx
      - app/src-tauri/src/services/workspace_service.rs
    missing:
      - "Fix save-on-exit path so note_save succeeds and no exit warning is shown."
---

# Phase 3: UAT Gaps

## Summary
- Autosave fails on every attempt and never records a successful save time.
- Exit save path fails and triggers the confirmation warning every time.

## Evidence
- Banner: "Autosave failed. Last saved: Not saved yet"
- Exit confirm: "Latest save failed. Exit anyway? Unsaved changes may be lost."
