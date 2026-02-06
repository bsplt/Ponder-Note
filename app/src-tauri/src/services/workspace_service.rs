use crate::domain::note::{NoteSidecar, NoteSummary};
use crate::domain::note_rewrite::rewrite_exit_checklists;
use crate::domain::note_title::derive_note_title;
use crate::domain::rebuild::{RebuildCounts, RebuildError, RebuildLog};
use crate::domain::todo::{extract_todos, toggle_checkbox_in_memory, TodoItem};
use crate::domain::workspace::{
    slot_to_index, AppConfig, WorkspaceFolderStatus, WorkspaceSlotState, WorkspaceState,
};
use crate::storage::app_config_repo::{AppConfigRepo, AppConfigRepoError};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;
use thiserror::Error;

macro_rules! dev_log {
    ($($arg:tt)*) => {
        {
            if cfg!(debug_assertions) {
                eprintln!($($arg)*);
            }
        }
    };
}

fn dev_log_io(op: &str, err: &std::io::Error) {
    dev_log!(
        "[ponder][note_save] {} failed: kind={:?} raw_os_error={:?} msg={}",
        op,
        err.kind(),
        err.raw_os_error(),
        err
    );
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvalidWorkspaceKind {
    Missing,
    Unreadable,
}

#[derive(Debug, Error)]
pub enum WorkspaceServiceError {
    #[error("invalid slot: {slot}")]
    InvalidSlot { slot: u8 },

    #[error("unassigned slot: {slot}")]
    UnassignedSlot { slot: u8 },

    #[error("invalid workspace for slot {slot}: {kind:?}")]
    InvalidWorkspace { slot: u8, kind: InvalidWorkspaceKind },

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Config(#[from] AppConfigRepoError),

    #[error("invalid todo toggle: {0}")]
    InvalidTodoToggle(String),

    #[error("note not found")]
    NoteNotFound,
}

pub struct WorkspaceService {
    repo: AppConfigRepo,
    cfg: AppConfig,
}

impl WorkspaceService {
    pub fn new(repo: AppConfigRepo) -> Result<Self, WorkspaceServiceError> {
        let cfg = repo.load()?;
        Ok(Self { repo, cfg })
    }

    pub fn get_state(&self) -> Result<WorkspaceState, WorkspaceServiceError> {
        let active_slot = self.cfg.active_slot;

        let active_status = match self.slot_path(active_slot)? {
            None => WorkspaceFolderStatus::Unassigned,
            Some(p) => validate_workspace_dir(Path::new(&p)),
        };

        let active_error_kind = match active_status {
            WorkspaceFolderStatus::Missing => Some("missing".to_string()),
            WorkspaceFolderStatus::Unreadable => Some("unreadable".to_string()),
            _ => None,
        };

        let slots = std::array::from_fn(|idx| {
            let slot = (idx as u8) + 1;
            let path = self.cfg.workspaces[idx].clone();
            let status = if slot == active_slot {
                Some(active_status)
            } else {
                None
            };
            let error_kind = if slot == active_slot {
                active_error_kind.clone()
            } else {
                None
            };
            WorkspaceSlotState {
                slot,
                path,
                status,
                error_kind,
            }
        });

        Ok(WorkspaceState {
            active_slot,
            fallback_slot: self.compute_fallback_slot()?,
            slots,
        })
    }

    pub fn assign_slot(
        &mut self,
        slot: u8,
        selected_path: String,
    ) -> Result<WorkspaceState, WorkspaceServiceError> {
        let idx = slot_index(slot)?;
        let stored_path = canonicalize_if_possible(&selected_path);

        self.cfg.workspaces[idx] = Some(stored_path);
        self.cfg.active_slot = slot;
        self.repo.save(&self.cfg)?;

        self.get_state()
    }

    pub fn switch_slot(&mut self, slot: u8) -> Result<WorkspaceState, WorkspaceServiceError> {
        if slot == self.cfg.active_slot {
            return self.get_state();
        }

        let path = self
            .slot_path(slot)?
            .ok_or(WorkspaceServiceError::UnassignedSlot { slot })?;

        match validate_workspace_dir(Path::new(&path)) {
            WorkspaceFolderStatus::Ok => {
                self.cfg.active_slot = slot;
                self.repo.save(&self.cfg)?;
                self.get_state()
            }
            WorkspaceFolderStatus::Missing => Err(WorkspaceServiceError::InvalidWorkspace {
                slot,
                kind: InvalidWorkspaceKind::Missing,
            }),
            WorkspaceFolderStatus::Unreadable => Err(WorkspaceServiceError::InvalidWorkspace {
                slot,
                kind: InvalidWorkspaceKind::Unreadable,
            }),
            WorkspaceFolderStatus::Unassigned => Err(WorkspaceServiceError::UnassignedSlot { slot }),
        }
    }

    pub fn list_root_notes(&self) -> Result<Vec<String>, WorkspaceServiceError> {
        let (slot, path) = self.active_workspace_path()?;
        let mut notes = list_root_md_basenames(&path).map_err(|_| {
            WorkspaceServiceError::InvalidWorkspace {
                slot,
                kind: InvalidWorkspaceKind::Unreadable,
            }
        })?;
        notes.sort();
        Ok(notes)
    }

    pub fn list_notes(&self) -> Result<Vec<NoteSummary>, WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        let meta_dir = path.join(".ponder").join("meta");
        std::fs::create_dir_all(&meta_dir)?;

        let mut notes = Vec::new();
        for entry in std::fs::read_dir(&path)? {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                continue;
            }

            let note_path = entry.path();
            if note_path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }

            let Some(stem) = note_path.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            let Ok(created_at) = stem.parse::<i64>() else {
                continue;
            };

            let content = std::fs::read_to_string(&note_path)?;
            let first_line = content.lines().next().unwrap_or("").to_string();
            let derived_title = derive_note_title(&first_line);

            let sidecar_path = meta_dir.join(format!("{stem}.json"));
            let (mut sidecar, mut should_write) = load_or_rebuild_sidecar(
                &sidecar_path,
                &derived_title,
                created_at,
            )?;

            if sidecar.created_at != created_at {
                sidecar.created_at = created_at;
                should_write = true;
            }

            if sidecar.title != derived_title {
                sidecar.title = derived_title.clone();
                should_write = true;
            }

            if should_write {
                write_sidecar(&sidecar_path, &sidecar)?;
            }

            let summary = NoteSummary {
                stem: stem.to_string(),
                title: sidecar.title.clone(),
                created_at: sidecar.created_at,
                updated_at: sidecar.updated_at,
                tags: sidecar.tags.clone().unwrap_or_default(),
                filename: format!("{stem}.md"),
                preview: content,
            };
            notes.push(summary);
        }

        notes.sort_by_key(|note| note.created_at);
        Ok(notes)
    }

    pub fn rebuild_active_workspace(&self) -> Result<RebuildLog, WorkspaceServiceError> {
        let (_slot, workspace_path) = self.active_workspace_path()?;
        let mut errors = Vec::new();

        let started_at = match current_unix_ms() {
            Ok(ts) => ts,
            Err(err) => {
                errors.push(RebuildError {
                    message: format!("timestamp error: {err}"),
                    note_stem: None,
                    path: None,
                });
                0
            }
        };

        let mut counts = RebuildCounts::default();
        let ponder_dir = workspace_path.join(".ponder");
        let meta_dir = ponder_dir.join("meta");
        let index_dir = ponder_dir.join("index");

        if let Err(err) = std::fs::create_dir_all(&meta_dir) {
            errors.push(RebuildError {
                message: format!("failed to create meta dir: {err}"),
                note_stem: None,
                path: Some(meta_dir.to_string_lossy().to_string()),
            });
        }

        if let Err(err) = std::fs::create_dir_all(&index_dir) {
            errors.push(RebuildError {
                message: format!("failed to create index dir: {err}"),
                note_stem: None,
                path: Some(index_dir.to_string_lossy().to_string()),
            });
        }

        match std::fs::read_dir(&workspace_path) {
            Ok(entries) => {
                for entry in entries {
                    let entry = match entry {
                        Ok(entry) => entry,
                        Err(err) => {
                            errors.push(RebuildError {
                                message: format!("failed to read workspace entry: {err}"),
                                note_stem: None,
                                path: Some(workspace_path.to_string_lossy().to_string()),
                            });
                            continue;
                        }
                    };

                    if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                        continue;
                    }

                    let note_path = entry.path();
                    if note_path.extension().and_then(|s| s.to_str()) != Some("md") {
                        continue;
                    }

                    let Some(stem) = note_path.file_stem().and_then(|s| s.to_str()) else {
                        continue;
                    };

                    let created_at = match stem.parse::<i64>() {
                        Ok(ts) => ts,
                        Err(_) => {
                            errors.push(RebuildError {
                                message: "invalid note filename timestamp".to_string(),
                                note_stem: Some(stem.to_string()),
                                path: Some(note_path.to_string_lossy().to_string()),
                            });
                            continue;
                        }
                    };

                    counts.notes_scanned += 1;

                    let first_line = match read_first_line(&note_path) {
                        Ok(line) => line,
                        Err(err) => {
                            errors.push(RebuildError {
                                message: format!("failed to read note: {err}"),
                                note_stem: Some(stem.to_string()),
                                path: Some(note_path.to_string_lossy().to_string()),
                            });
                            continue;
                        }
                    };

                    let derived_title = derive_note_title(&first_line);
                    let sidecar_path = meta_dir.join(format!("{stem}.json"));

                    let mut existing_sidecar = None;
                    let mut preserved_extra = BTreeMap::new();
                    let mut had_sidecar = false;

                    match std::fs::read_to_string(&sidecar_path) {
                        Ok(raw) => {
                            had_sidecar = true;
                            match serde_json::from_str::<Value>(&raw) {
                                Ok(value) => {
                                    let (parsed, extra) = parse_sidecar_value(value);
                                    preserved_extra = extra;
                                    existing_sidecar = parsed;
                                }
                                Err(err) => {
                                    errors.push(RebuildError {
                                        message: format!("invalid sidecar json: {err}"),
                                        note_stem: Some(stem.to_string()),
                                        path: Some(sidecar_path.to_string_lossy().to_string()),
                                    });
                                }
                            }
                        }
                        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                        Err(err) => {
                            had_sidecar = true;
                            errors.push(RebuildError {
                                message: format!("failed to read sidecar: {err}"),
                                note_stem: Some(stem.to_string()),
                                path: Some(sidecar_path.to_string_lossy().to_string()),
                            });
                        }
                    }

                    let mut should_write = false;
                    let mut repaired = false;
                    let mut sidecar = match existing_sidecar {
                        Some(sidecar) => sidecar,
                        None => {
                            should_write = true;
                            if had_sidecar {
                                counts.sidecars_repaired += 1;
                            } else {
                                counts.sidecars_created += 1;
                            }
                            NoteSidecar {
                                title: derived_title.clone(),
                                created_at,
                                updated_at: None,
                                tags: None,
                                extra: preserved_extra,
                            }
                        }
                    };

                    if sidecar.created_at != created_at {
                        sidecar.created_at = created_at;
                        repaired = true;
                    }

                    if sidecar.title != derived_title {
                        sidecar.title = derived_title;
                        repaired = true;
                    }

                    if repaired {
                        should_write = true;
                        if had_sidecar {
                            counts.sidecars_repaired += 1;
                        } else {
                            counts.sidecars_created += 1;
                        }
                    }

                    if should_write {
                        if let Err(err) = atomic_write_sidecar(&sidecar_path, &sidecar) {
                            errors.push(RebuildError {
                                message: format!("failed to write sidecar: {err}"),
                                note_stem: Some(stem.to_string()),
                                path: Some(sidecar_path.to_string_lossy().to_string()),
                            });
                        }
                    }
                }
            }
            Err(err) => {
                errors.push(RebuildError {
                    message: format!("failed to read workspace directory: {err}"),
                    note_stem: None,
                    path: Some(workspace_path.to_string_lossy().to_string()),
                });
            }
        }

        let index_created_at = match current_unix_ms() {
            Ok(ts) => ts,
            Err(err) => {
                errors.push(RebuildError {
                    message: format!("timestamp error: {err}"),
                    note_stem: None,
                    path: None,
                });
                0
            }
        };

        if let Err(err) = write_index_marker(&index_dir, index_created_at) {
            errors.push(RebuildError {
                message: format!("failed to write index marker: {err}"),
                note_stem: None,
                path: Some(index_dir.to_string_lossy().to_string()),
            });
        }

        let finished_at = match current_unix_ms() {
            Ok(ts) => ts,
            Err(err) => {
                errors.push(RebuildError {
                    message: format!("timestamp error: {err}"),
                    note_stem: None,
                    path: None,
                });
                started_at
            }
        };

        let mut log = RebuildLog {
            started_at,
            finished_at,
            workspace_path: workspace_path.to_string_lossy().to_string(),
            counts,
            errors,
        };

        if let Err(err) = write_rebuild_log(&workspace_path, &log) {
            log.errors.push(RebuildError {
                message: format!("rebuild log write failed: {err}"),
                note_stem: None,
                path: Some(rebuild_log_path(&workspace_path).to_string_lossy().to_string()),
            });
            let _ = write_rebuild_log(&workspace_path, &log);
        }

        Ok(log)
    }

    pub fn get_rebuild_log(&self) -> Result<Option<RebuildLog>, WorkspaceServiceError> {
        let (_slot, workspace_path) = self.active_workspace_path()?;
        read_rebuild_log(&workspace_path)
    }

    pub fn create_note(&self) -> Result<NoteSummary, WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        let meta_dir = path.join(".ponder").join("meta");
        std::fs::create_dir_all(&meta_dir)?;

        let mut created_at = current_unix_ms()?;
        let mut note_path = path.join(format!("{created_at}.md"));
        while note_path.exists() {
            created_at += 1;
            note_path = path.join(format!("{created_at}.md"));
        }

        std::fs::write(&note_path, "")?;

        let sidecar = NoteSidecar {
            title: "Untitled".to_string(),
            created_at,
            updated_at: None,
            tags: None,
            extra: BTreeMap::new(),
        };
        let sidecar_path = meta_dir.join(format!("{created_at}.json"));
        write_sidecar(&sidecar_path, &sidecar)?;

        Ok(NoteSummary {
            stem: created_at.to_string(),
            title: sidecar.title,
            created_at,
            updated_at: None,
            tags: Vec::new(),
            filename: format!("{created_at}.md"),
            preview: String::new(),
        })
    }

    pub fn note_read(&self, stem: &str) -> Result<String, WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        let note_path = self.note_path_from_stem(&path, stem)?;
        Ok(std::fs::read_to_string(&note_path)?)
    }

    pub fn note_save(
        &self,
        stem: &str,
        body: &str,
        rewrite_on_exit: bool,
    ) -> Result<(), WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        let note_path = self
            .note_path_from_stem(&path, stem)
            .map_err(|err| note_save_error_with_context(err, stem, &path))?;
        let payload = if rewrite_on_exit {
            rewrite_exit_checklists(body)
        } else {
            body.to_string()
        };
        atomic_write_note(&path, &note_path, &payload)
            .map_err(|err| note_save_error_with_context(err, stem, &path))
    }

    pub fn note_discard(&self, stem: &str) -> Result<(), WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        let note_path = self.note_path_from_stem(&path, stem)?;
        remove_file_if_exists(&note_path)?;

        let sidecar_path = path
            .join(".ponder")
            .join("meta")
            .join(format!("{stem}.json"));
        remove_file_if_exists(&sidecar_path)?;
        Ok(())
    }

    pub fn note_delete(&self, stem: &str) -> Result<(), WorkspaceServiceError> {
        let (_slot, workspace_path) = self.active_workspace_path()?;

        // Source note path
        let note_path = workspace_path.join(format!("{stem}.md"));
        if !note_path.exists() {
            return Err(WorkspaceServiceError::NoteNotFound);
        }

        // Ensure deleted/ folder exists
        let deleted_dir = workspace_path.join("deleted");
        std::fs::create_dir_all(&deleted_dir)?;

        // Target path with conflict handling (numeric suffix _1, _2, …)
        let mut target_path = deleted_dir.join(format!("{stem}.md"));
        let mut suffix = 1;
        while target_path.exists() {
            target_path = deleted_dir.join(format!("{stem}_{suffix}.md"));
            suffix += 1;
        }

        // Move note file atomically
        std::fs::rename(&note_path, &target_path)?;

        // Leave sidecar in place (becomes orphaned) – do NOT delete .ponder/meta/{stem}.json

        Ok(())
    }

    pub fn get_all_tags(&self) -> Result<Vec<String>, WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        let meta_dir = path.join(".ponder").join("meta");

        // If meta dir doesn't exist yet, return empty list
        if !meta_dir.exists() {
            return Ok(Vec::new());
        }

        let mut all_tags = std::collections::HashSet::new();

        // Read all sidecar files and collect tags
        for entry in std::fs::read_dir(&meta_dir)? {
            let entry = entry?;
            if !entry.file_type()?.is_file() {
                continue;
            }

            let sidecar_path = entry.path();
            if sidecar_path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }

            // Try to read and parse the sidecar
            if let Ok(raw) = std::fs::read_to_string(&sidecar_path) {
                if let Ok(sidecar) = serde_json::from_str::<NoteSidecar>(&raw) {
                    // Collect tags if present
                    if let Some(tags) = sidecar.tags {
                        for tag in tags {
                            all_tags.insert(tag);
                        }
                    }
                }
                // Skip sidecars with missing or invalid tags fields (don't fail)
            }
        }

        // Convert to Vec and sort alphabetically (case-insensitive)
        let mut tags_vec: Vec<String> = all_tags.into_iter().collect();
        tags_vec.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));

        Ok(tags_vec)
    }

    pub fn update_note_tags(&self, stem: &str, tags: Vec<String>) -> Result<(), WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        
        // Verify the note Markdown file exists
        let note_path = self.note_path_from_stem(&path, stem)?;
        if !note_path.exists() {
            return Err(WorkspaceServiceError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "note_not_found",
            )));
        }

        let sidecar_path = path
            .join(".ponder")
            .join("meta")
            .join(format!("{stem}.json"));

        // Verify the sidecar exists
        if !sidecar_path.exists() {
            return Err(WorkspaceServiceError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "note_not_found",
            )));
        }

        // Load existing sidecar
        let raw = std::fs::read_to_string(&sidecar_path)?;
        let mut sidecar: NoteSidecar = serde_json::from_str(&raw)?;

        // Process tags: trim whitespace, filter empty, sort alphabetically
        let mut processed_tags: Vec<String> = tags
            .into_iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
        processed_tags.sort();

        // Update tags (use None if empty to match existing pattern)
        sidecar.tags = if processed_tags.is_empty() {
            None
        } else {
            Some(processed_tags)
        };

        // Write atomically: write to temp file, then rename
        atomic_write_sidecar(&sidecar_path, &sidecar)?;

        Ok(())
    }

    pub fn list_todos(&self) -> Result<Vec<TodoItem>, WorkspaceServiceError> {
        let notes = self.list_notes()?;
        let mut all_todos = Vec::new();
        
        for note in notes {
            let note_path = self.workspace_dir()?.join(&note.filename);
            match std::fs::read_to_string(&note_path) {
                Ok(body) => {
                    let todos = extract_todos(&note.stem, &body);
                    all_todos.extend(todos);
                }
                Err(err) => {
                    dev_log!("[list_todos] Failed to read {}: {}", note.stem, err);
                    // Continue with other notes
                }
            }
        }
        
        // Filter to show only open todos by default (TODO-01 requirement)
        let open_todos: Vec<TodoItem> = all_todos.into_iter()
            .filter(|todo| !todo.checked)
            .collect();
        
        Ok(open_todos)
    }

    pub fn toggle_todo(
        &self,
        stem: &str,
        line_number: usize,
        char_offset: usize,
    ) -> Result<bool, WorkspaceServiceError> {
        let workspace_dir = self.workspace_dir()?;
        let note_path = workspace_dir.join(format!("{}.md", stem));
        
        if !note_path.exists() {
            return Err(WorkspaceServiceError::NoteNotFound);
        }
        
        let body = std::fs::read_to_string(&note_path)?;
        
        match toggle_checkbox_in_memory(&body, line_number, char_offset) {
            Ok((new_body, new_state)) => {
                atomic_write_note(&workspace_dir, &note_path, &new_body)?;
                Ok(new_state)
            }
            Err(toggle_err) => {
                Err(WorkspaceServiceError::InvalidTodoToggle(format!("{:?}", toggle_err)))
            }
        }
    }

    fn workspace_dir(&self) -> Result<PathBuf, WorkspaceServiceError> {
        let (_slot, path) = self.active_workspace_path()?;
        Ok(path)
    }

    fn note_path_from_stem(
        &self,
        workspace_path: &Path,
        stem: &str,
    ) -> Result<PathBuf, WorkspaceServiceError> {
        validate_note_stem(stem)?;
        Ok(workspace_path.join(format!("{stem}.md")))
    }

    fn slot_path(&self, slot: u8) -> Result<Option<String>, WorkspaceServiceError> {
        let idx = slot_index(slot)?;
        Ok(self.cfg.workspaces[idx].clone())
    }

    fn compute_fallback_slot(&self) -> Result<Option<u8>, WorkspaceServiceError> {
        for slot in 1..=9 {
            let Some(path) = self.slot_path(slot)? else {
                continue;
            };

            if validate_workspace_dir(Path::new(&path)) == WorkspaceFolderStatus::Ok {
                return Ok(Some(slot));
            }
        }
        Ok(None)
    }

    fn active_workspace_path(&self) -> Result<(u8, PathBuf), WorkspaceServiceError> {
        let slot = self.cfg.active_slot;
        let path = self
            .slot_path(slot)?
            .ok_or(WorkspaceServiceError::UnassignedSlot { slot })?;

        match validate_workspace_dir(Path::new(&path)) {
            WorkspaceFolderStatus::Ok => Ok((slot, PathBuf::from(path))),
            WorkspaceFolderStatus::Missing => Err(WorkspaceServiceError::InvalidWorkspace {
                slot,
                kind: InvalidWorkspaceKind::Missing,
            }),
            WorkspaceFolderStatus::Unreadable => Err(WorkspaceServiceError::InvalidWorkspace {
                slot,
                kind: InvalidWorkspaceKind::Unreadable,
            }),
            WorkspaceFolderStatus::Unassigned => Err(WorkspaceServiceError::UnassignedSlot { slot }),
        }
    }
}

fn slot_index(slot: u8) -> Result<usize, WorkspaceServiceError> {
    slot_to_index(slot).ok_or(WorkspaceServiceError::InvalidSlot { slot })
}

fn canonicalize_if_possible(input: &str) -> String {
    match std::fs::canonicalize(PathBuf::from(input)) {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => input.to_string(),
    }
}

fn validate_workspace_dir(path: &Path) -> WorkspaceFolderStatus {
    let meta = match std::fs::metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return WorkspaceFolderStatus::Missing,
        Err(_) => return WorkspaceFolderStatus::Unreadable,
    };

    if !meta.is_dir() {
        return WorkspaceFolderStatus::Unreadable;
    }

    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return WorkspaceFolderStatus::Unreadable,
    };

    for entry in entries {
        if entry.is_err() {
            return WorkspaceFolderStatus::Unreadable;
        }
    }

    WorkspaceFolderStatus::Ok
}

fn list_root_md_basenames(dir: &Path) -> std::io::Result<Vec<String>> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }

        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }

        let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        out.push(name.to_string());
    }
    Ok(out)
}

fn read_first_line(path: &Path) -> Result<String, WorkspaceServiceError> {
    let file = std::fs::File::open(path)?;
    let mut reader = std::io::BufReader::new(file);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    Ok(line.trim_end_matches(&['\r', '\n'][..]).to_string())
}

fn load_or_rebuild_sidecar(
    path: &Path,
    title: &str,
    created_at: i64,
) -> Result<(NoteSidecar, bool), WorkspaceServiceError> {
    let mut should_write = false;
    let mut preserved_extra = BTreeMap::new();

    let sidecar = match std::fs::read_to_string(path) {
        Ok(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(value) => {
                let (parsed, extra) = parse_sidecar_value(value);
                preserved_extra = extra;
                parsed
            }
            Err(_) => None,
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(WorkspaceServiceError::Io(e)),
    };

    let sidecar = match sidecar {
        Some(sidecar) => sidecar,
        None => {
            should_write = true;
            NoteSidecar {
                title: title.to_string(),
                created_at,
                updated_at: None,
                tags: None,
                extra: preserved_extra,
            }
        }
    };

    Ok((sidecar, should_write))
}

fn rebuild_log_path(workspace_path: &Path) -> PathBuf {
    workspace_path.join(".ponder").join("rebuild-log.json")
}

fn write_rebuild_log(
    workspace_path: &Path,
    log: &RebuildLog,
) -> Result<(), WorkspaceServiceError> {
    let ponder_dir = workspace_path.join(".ponder");
    std::fs::create_dir_all(&ponder_dir)?;

    let json = serde_json::to_string_pretty(log)?;
    let target_path = rebuild_log_path(workspace_path);

    let mut tmp = NamedTempFile::new_in(&ponder_dir)?;
    tmp.write_all(json.as_bytes())?;
    tmp.as_file().sync_all()?;

    match tmp.persist(&target_path) {
        Ok(_) => Ok(()),
        Err(err) => {
            if err.error.kind() == std::io::ErrorKind::AlreadyExists {
                std::fs::write(&target_path, json)?;
                Ok(())
            } else {
                Err(WorkspaceServiceError::Io(err.error))
            }
        }
    }
}

fn read_rebuild_log(workspace_path: &Path) -> Result<Option<RebuildLog>, WorkspaceServiceError> {
    let path = rebuild_log_path(workspace_path);
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(_) => return Ok(None),
    };

    match serde_json::from_str::<RebuildLog>(&raw) {
        Ok(log) => Ok(Some(log)),
        Err(_) => Ok(None),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexVersionMarker {
    schema_version: u32,
    created_at: i64,
}

fn write_index_marker(index_dir: &Path, created_at: i64) -> Result<(), WorkspaceServiceError> {
    std::fs::create_dir_all(index_dir)?;
    let marker = IndexVersionMarker {
        schema_version: 1,
        created_at,
    };
    let json = serde_json::to_string_pretty(&marker)?;
    let target_path = index_dir.join("version.json");

    let mut tmp = NamedTempFile::new_in(index_dir)?;
    tmp.write_all(json.as_bytes())?;
    tmp.as_file().sync_all()?;

    match tmp.persist(&target_path) {
        Ok(_) => Ok(()),
        Err(err) => {
            if err.error.kind() == std::io::ErrorKind::AlreadyExists {
                std::fs::write(&target_path, json)?;
                Ok(())
            } else {
                Err(WorkspaceServiceError::Io(err.error))
            }
        }
    }
}

fn parse_sidecar_value(value: Value) -> (Option<NoteSidecar>, BTreeMap<String, Value>) {
    match value {
        Value::Object(map) => {
            let extra = extract_extra(map.clone());
            let parsed = serde_json::from_value::<NoteSidecar>(Value::Object(map)).ok();
            (parsed, extra)
        }
        _ => (None, BTreeMap::new()),
    }
}

fn extract_extra(map: serde_json::Map<String, Value>) -> BTreeMap<String, Value> {
    let mut extra = BTreeMap::new();
    for (key, value) in map {
        if matches!(
            key.as_str(),
            "title"
                | "createdAt"
                | "created_at"
                | "updatedAt"
                | "updated_at"
                | "tags"
        ) {
            continue;
        }
        extra.insert(key, value);
    }
    extra
}

fn write_sidecar(path: &Path, sidecar: &NoteSidecar) -> Result<(), WorkspaceServiceError> {
    let json = serde_json::to_string_pretty(sidecar)?;
    std::fs::write(path, json)?;
    Ok(())
}

fn atomic_write_sidecar(path: &Path, sidecar: &NoteSidecar) -> Result<(), WorkspaceServiceError> {
    let json = serde_json::to_string_pretty(sidecar)?;
    
    // Get parent directory for temp file
    let parent = path.parent().ok_or_else(|| {
        WorkspaceServiceError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "invalid sidecar path",
        ))
    })?;

    // Write to temp file first
    let mut tmp = NamedTempFile::new_in(parent)?;
    tmp.write_all(json.as_bytes())?;
    tmp.as_file().sync_all()?;

    // Rename to target (atomic on same filesystem)
    match tmp.persist(path) {
        Ok(_) => Ok(()),
        Err(err) => {
            // Fallback: if persist fails (e.g., cross-filesystem), try direct write
            if err.error.kind() == std::io::ErrorKind::AlreadyExists {
                std::fs::write(path, json)?;
                Ok(())
            } else {
                Err(WorkspaceServiceError::Io(err.error))
            }
        }
    }
}

fn validate_note_stem(stem: &str) -> Result<(), WorkspaceServiceError> {
    if stem.is_empty() || stem == "." || stem == ".." {
        return Err(WorkspaceServiceError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "invalid note stem",
        )));
    }

    if stem.contains('/') || stem.contains('\\') {
        return Err(WorkspaceServiceError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "invalid note stem",
        )));
    }

    Ok(())
}

fn atomic_write_note(
    workspace_dir: &Path,
    target_path: &Path,
    body: &str,
) -> Result<(), WorkspaceServiceError> {
    dev_log!(
        "[ponder][note_save] atomic_write_note start workspace_dir='{}' target_path='{}' bytes={} target_exists={}",
        workspace_dir.display(),
        target_path.display(),
        body.as_bytes().len(),
        target_path.exists()
    );

    match std::fs::symlink_metadata(target_path) {
        Ok(meta) => dev_log!(
            "[ponder][note_save] target metadata: is_file={} is_symlink={} readonly={}",
            meta.is_file(),
            meta.file_type().is_symlink(),
            meta.permissions().readonly()
        ),
        Err(e) => dev_log!(
            "[ponder][note_save] target metadata error: kind={:?} raw_os_error={:?} msg={}",
            e.kind(),
            e.raw_os_error(),
            e
        ),
    }

    let mut tmp = match NamedTempFile::new_in(workspace_dir) {
        Ok(t) => t,
        Err(e) => {
            dev_log_io("create temp file (NamedTempFile::new_in)", &e);
            return Err(WorkspaceServiceError::Io(e));
        }
    };
    dev_log!(
        "[ponder][note_save] tmp created path='{}'",
        tmp.path().display()
    );

    if let Err(e) = tmp.write_all(body.as_bytes()) {
        dev_log_io("write temp file (write_all)", &e);
        return Err(WorkspaceServiceError::Io(e));
    }
    if let Err(e) = tmp.as_file().sync_all() {
        dev_log_io("sync temp file (sync_all)", &e);
        return Err(WorkspaceServiceError::Io(e));
    }

    match tmp.persist(target_path) {
        Ok(_) => {
            dev_log!("[ponder][note_save] persist ok");
            Ok(())
        }
        Err(err) => {
            dev_log!(
                "[ponder][note_save] persist failed: kind={:?} raw_os_error={:?} msg={} tmp='{}' target='{}'",
                err.error.kind(),
                err.error.raw_os_error(),
                err.error,
                err.file.path().display(),
                target_path.display()
            );

            // `persist` refuses to clobber existing targets. Historically we tried a rename-overwrite,
            // but on some systems (notably sandboxed environments) "replace existing file" can fail
            // even though creating a new file in the directory works. Fall back to an in-place write
            // (truncate + write) when necessary.
            if err.error.kind() == std::io::ErrorKind::AlreadyExists {
                dev_log!("[ponder][note_save] fallback: in-place overwrite (truncate + write)");
                match write_note_in_place(target_path, body) {
                    Ok(()) => {
                        dev_log!("[ponder][note_save] in-place overwrite ok");
                        return Ok(());
                    }
                    Err(e) => dev_log_io("in-place overwrite (OpenOptions+truncate)", &e),
                }

                // If in-place write is denied, try a remove-then-persist strategy so the final step
                // is creating the target path, not replacing it.
                dev_log!("[ponder][note_save] fallback: remove-then-persist");
                if let Err(e) = std::fs::remove_file(target_path) {
                    dev_log_io("remove target before persist (remove_file)", &e);
                }
                match err.file.persist(target_path) {
                    Ok(_) => {
                        dev_log!("[ponder][note_save] remove-then-persist ok");
                        Ok(())
                    }
                    Err(err2) => {
                        dev_log!(
                            "[ponder][note_save] remove-then-persist failed: kind={:?} raw_os_error={:?} msg={}",
                            err2.error.kind(),
                            err2.error.raw_os_error(),
                            err2.error
                        );
                        match write_note_in_place(target_path, body) {
                            Ok(()) => {
                                dev_log!("[ponder][note_save] in-place overwrite ok (after remove-then-persist)");
                                return Ok(());
                            }
                            Err(e) => dev_log_io(
                                "in-place overwrite after remove-then-persist (OpenOptions+truncate)",
                                &e,
                            ),
                        }
                        Err(WorkspaceServiceError::Io(err2.error))
                    }
                }
            } else if err.error.kind() == std::io::ErrorKind::PermissionDenied {
                // Best-effort: if atomic persist fails due to permission semantics, try the simpler
                // write path before surfacing the error.
                dev_log!("[ponder][note_save] persist PermissionDenied; fallback: in-place overwrite (truncate + write)");
                match write_note_in_place(target_path, body) {
                    Ok(()) => {
                        dev_log!("[ponder][note_save] in-place overwrite ok");
                        return Ok(());
                    }
                    Err(e) => dev_log_io(
                        "in-place overwrite after persist PermissionDenied (OpenOptions+truncate)",
                        &e,
                    ),
                }
                Err(WorkspaceServiceError::Io(err.error))
            } else {
                Err(WorkspaceServiceError::Io(err.error))
            }
        }
    }
}

fn write_note_in_place(target_path: &Path, body: &str) -> std::io::Result<()> {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(target_path)?;
    file.write_all(body.as_bytes())?;
    file.sync_all()?;
    Ok(())
}

fn note_save_error_with_context(
    err: WorkspaceServiceError,
    stem: &str,
    workspace_path: &Path,
) -> WorkspaceServiceError {
    match err {
        WorkspaceServiceError::Io(source) => {
            let raw_os_error = source.raw_os_error();
            WorkspaceServiceError::Io(std::io::Error::new(
                source.kind(),
                format!(
                    "note_save failed for stem '{stem}' in workspace '{}': (raw_os_error={raw_os_error:?}) {source}",
                    workspace_path.display()
                ),
            ))
        }
        other => other,
    }
}

fn remove_file_if_exists(path: &Path) -> Result<(), WorkspaceServiceError> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(WorkspaceServiceError::Io(e)),
    }
}

fn current_unix_ms() -> Result<i64, WorkspaceServiceError> {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    Ok(duration.as_millis() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_note_creates_new_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("new.md");

        atomic_write_note(dir.path(), &target, "hello").unwrap();

        let body = std::fs::read_to_string(&target).unwrap();
        assert_eq!(body, "hello");
    }

    #[test]
    fn atomic_write_note_overwrites_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("existing.md");

        std::fs::write(&target, "old").unwrap();
        atomic_write_note(dir.path(), &target, "new").unwrap();

        let body = std::fs::read_to_string(&target).unwrap();
        assert_eq!(body, "new");
    }

    /// Helper: simulate the note_delete file-move logic in an isolated temp workspace.
    /// Returns (workspace_root, deleted_dir).
    fn setup_delete_workspace(stem: &str, body: &str) -> (tempfile::TempDir, PathBuf) {
        let ws = tempfile::tempdir().unwrap();
        let note = ws.path().join(format!("{stem}.md"));
        std::fs::write(&note, body).unwrap();

        // Create orphan sidecar
        let meta = ws.path().join(".ponder").join("meta");
        std::fs::create_dir_all(&meta).unwrap();
        std::fs::write(meta.join(format!("{stem}.json")), "{}").unwrap();

        let deleted = ws.path().join("deleted");
        (ws, deleted)
    }

    /// Core move logic extracted so unit tests can exercise it without a full WorkspaceService.
    fn do_note_delete(workspace_path: &Path, stem: &str) -> std::io::Result<()> {
        let note_path = workspace_path.join(format!("{stem}.md"));
        if !note_path.exists() {
            return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "note not found"));
        }
        let deleted_dir = workspace_path.join("deleted");
        std::fs::create_dir_all(&deleted_dir)?;

        let mut target_path = deleted_dir.join(format!("{stem}.md"));
        let mut suffix = 1;
        while target_path.exists() {
            target_path = deleted_dir.join(format!("{stem}_{suffix}.md"));
            suffix += 1;
        }
        std::fs::rename(&note_path, &target_path)
    }

    #[test]
    fn note_delete_moves_file_to_deleted_folder() {
        let (ws, deleted) = setup_delete_workspace("1234567890", "# Hello");

        do_note_delete(ws.path(), "1234567890").unwrap();

        // Note moved
        assert!(!ws.path().join("1234567890.md").exists());
        assert!(deleted.join("1234567890.md").exists());

        // Sidecar still present (orphaned)
        assert!(ws.path().join(".ponder").join("meta").join("1234567890.json").exists());
    }

    #[test]
    fn note_delete_creates_deleted_dir_if_missing() {
        let (ws, deleted) = setup_delete_workspace("1111111111", "body");
        assert!(!deleted.exists());

        do_note_delete(ws.path(), "1111111111").unwrap();

        assert!(deleted.exists());
        assert!(deleted.join("1111111111.md").exists());
    }

    #[test]
    fn note_delete_conflict_handling_numeric_suffix() {
        let (ws, deleted) = setup_delete_workspace("2222222222", "first");
        std::fs::create_dir_all(&deleted).unwrap();

        // Pre-place a file at the base target to simulate a prior delete
        std::fs::write(deleted.join("2222222222.md"), "already here").unwrap();

        do_note_delete(ws.path(), "2222222222").unwrap();

        // Original slot taken → should be _1
        assert!(deleted.join("2222222222.md").exists());
        assert!(deleted.join("2222222222_1.md").exists());
        assert_eq!(
            std::fs::read_to_string(deleted.join("2222222222.md")).unwrap(),
            "already here"
        );
        assert_eq!(
            std::fs::read_to_string(deleted.join("2222222222_1.md")).unwrap(),
            "first"
        );
    }

    #[test]
    fn note_delete_conflict_handling_multiple_suffixes() {
        let (ws, deleted) = setup_delete_workspace("3333333333", "third");
        std::fs::create_dir_all(&deleted).unwrap();

        // Pre-fill base + _1
        std::fs::write(deleted.join("3333333333.md"), "base").unwrap();
        std::fs::write(deleted.join("3333333333_1.md"), "first").unwrap();

        do_note_delete(ws.path(), "3333333333").unwrap();

        assert!(deleted.join("3333333333_2.md").exists());
        assert_eq!(
            std::fs::read_to_string(deleted.join("3333333333_2.md")).unwrap(),
            "third"
        );
    }

    #[test]
    fn note_delete_returns_error_when_note_missing() {
        let ws = tempfile::tempdir().unwrap();
        // No note file created

        let result = do_note_delete(ws.path(), "9999999999");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().kind(), std::io::ErrorKind::NotFound);
    }
}
