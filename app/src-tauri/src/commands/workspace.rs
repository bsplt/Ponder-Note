use crate::domain::workspace::{CommandResult, WorkspaceState};
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
        Ok(state) => CommandResult::ok(state),
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
        Ok(state) => CommandResult::ok(state),
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
        Ok(state) => CommandResult::ok(state),
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

fn map_error_code(err: &WorkspaceServiceError) -> &'static str {
    match err {
        WorkspaceServiceError::InvalidSlot { .. } => "invalid_slot",
        WorkspaceServiceError::UnassignedSlot { .. } => "unassigned_slot",
        WorkspaceServiceError::InvalidWorkspace { kind, .. } => match kind {
            InvalidWorkspaceKind::Missing => "workspace_missing",
            InvalidWorkspaceKind::Unreadable => "workspace_unreadable",
        },
        WorkspaceServiceError::Config(_) => "config_error",
    }
}
