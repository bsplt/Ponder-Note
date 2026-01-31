use crate::domain::note::{NoteSidecar, NoteSummary};
use crate::domain::note_rewrite::rewrite_exit_checklists;
use crate::domain::note_title::derive_note_title;
use crate::domain::workspace::{
    slot_to_index, AppConfig, WorkspaceFolderStatus, WorkspaceSlotState, WorkspaceState,
};
use crate::storage::app_config_repo::{AppConfigRepo, AppConfigRepoError};
use serde_json::Value;
use std::collections::BTreeMap;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;
use thiserror::Error;

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

            let first_line = read_first_line(&note_path)?;
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
            };
            notes.push(summary);
        }

        notes.sort_by_key(|note| note.created_at);
        Ok(notes)
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
        let note_path = self.note_path_from_stem(&path, stem)?;
        let payload = if rewrite_on_exit {
            rewrite_exit_checklists(body)
        } else {
            body.to_string()
        };
        atomic_write_note(&path, &note_path, &payload)
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
    let mut tmp = NamedTempFile::new_in(workspace_dir)?;
    tmp.write_all(body.as_bytes())?;
    tmp.as_file().sync_all()?;
    tmp.persist(target_path).map_err(|e| e.error)?;
    Ok(())
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
