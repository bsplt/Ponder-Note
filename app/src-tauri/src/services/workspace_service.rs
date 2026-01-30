use crate::domain::workspace::{
    slot_to_index, AppConfig, WorkspaceFolderStatus, WorkspaceSlotState, WorkspaceState,
};
use crate::storage::app_config_repo::{AppConfigRepo, AppConfigRepoError};
use std::path::{Path, PathBuf};
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

        let slots = std::array::from_fn(|idx| {
            let slot = (idx as u8) + 1;
            let path = self.cfg.workspaces[idx].clone();
            let status = if slot == active_slot {
                Some(active_status)
            } else {
                None
            };
            WorkspaceSlotState { slot, path, status }
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
        let slot = self.cfg.active_slot;
        let path = self
            .slot_path(slot)?
            .ok_or(WorkspaceServiceError::UnassignedSlot { slot })?;

        match validate_workspace_dir(Path::new(&path)) {
            WorkspaceFolderStatus::Ok => {
                let mut notes = list_root_md_basenames(Path::new(&path))
                    .map_err(|_| WorkspaceServiceError::InvalidWorkspace {
                        slot,
                        kind: InvalidWorkspaceKind::Unreadable,
                    })?;
                notes.sort();
                Ok(notes)
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
