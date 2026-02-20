use crate::domain::note::NoteSummary;
use crate::domain::rebuild::RebuildLog;
use crate::domain::workspace::{CommandResult, WorkspaceFolderStatus, WorkspaceState};
use crate::services::workspace_service::{InvalidWorkspaceKind, WorkspaceService, WorkspaceServiceError};
use std::sync::Mutex;

#[tauri::command]
pub fn workspace_get_state(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<WorkspaceState> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.get_state() {
        Ok(state) => {
            if active_workspace_ok(&state) {
                let _ = svc.rebuild_active_workspace();
            }
            CommandResult::ok(state)
        }
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_assign_slot(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    slot: u8,
    path: String,
) -> CommandResult<WorkspaceState> {
    let mut svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.assign_slot(slot, path) {
        Ok(state) => {
            if active_workspace_ok(&state) {
                let _ = svc.rebuild_active_workspace();
            }
            CommandResult::ok(state)
        }
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_unassign_slot(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    slot: u8,
) -> CommandResult<WorkspaceState> {
    let mut svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.unassign_slot(slot) {
        Ok(state) => {
            if active_workspace_ok(&state) {
                let _ = svc.rebuild_active_workspace();
            }
            CommandResult::ok(state)
        }
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_switch_slot(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    slot: u8,
) -> CommandResult<WorkspaceState> {
    let mut svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.switch_slot(slot) {
        Ok(state) => {
            if active_workspace_ok(&state) {
                let _ = svc.rebuild_active_workspace();
            }
            CommandResult::ok(state)
        }
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_rebuild(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<RebuildLog> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.rebuild_active_workspace() {
        Ok(log) => CommandResult::ok(log),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_get_rebuild_log(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<Option<RebuildLog>> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.get_rebuild_log() {
        Ok(log) => CommandResult::ok(log),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_list_root_notes(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<Vec<String>> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.list_root_notes() {
        Ok(notes) => CommandResult::ok(notes),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_list_notes(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<Vec<NoteSummary>> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.list_notes() {
        Ok(notes) => CommandResult::ok(notes),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_create_note(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<NoteSummary> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.create_note() {
        Ok(note) => CommandResult::ok(note),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_update_note_tags(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    stem: String,
    tags: Vec<String>,
) -> CommandResult<()> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.update_note_tags(&stem, tags) {
        Ok(()) => CommandResult::ok(()),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_get_all_tags(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<Vec<String>> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.get_all_tags() {
        Ok(tags) => CommandResult::ok(tags),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

fn map_error_code(err: &WorkspaceServiceError) -> &'static str {
    match err {
        WorkspaceServiceError::InvalidSlot { .. } => "invalid_slot",
        WorkspaceServiceError::UnassignedSlot { .. } => "unassigned_slot",
        WorkspaceServiceError::InvalidWorkspace { kind, .. } => match kind {
            InvalidWorkspaceKind::Missing => "workspace_missing",
            InvalidWorkspaceKind::Unreadable => "workspace_unreadable",
        },
        WorkspaceServiceError::Io(e) => {
            // Check for note_not_found in the error message
            if e.to_string().contains("note_not_found") {
                "note_not_found"
            } else {
                "io_error"
            }
        }
        WorkspaceServiceError::Json(_) => "json_error",
        WorkspaceServiceError::Config(_) => "config_error",
        WorkspaceServiceError::InvalidTodoToggle(_) => "invalid_todo_toggle",
        WorkspaceServiceError::NoteNotFound => "note_not_found",
    }
}

fn active_workspace_ok(state: &WorkspaceState) -> bool {
    let idx = state.active_slot.saturating_sub(1) as usize;
    state
        .slots
        .get(idx)
        .and_then(|slot| slot.status)
        == Some(WorkspaceFolderStatus::Ok)
}
