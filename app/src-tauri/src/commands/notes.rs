use crate::domain::workspace::CommandResult;
use crate::services::workspace_service::{
    InvalidWorkspaceKind, WorkspaceService, WorkspaceServiceError,
};
use std::sync::Mutex;

#[tauri::command]
pub fn note_read(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    stem: String,
) -> CommandResult<String> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.note_read(&stem) {
        Ok(body) => CommandResult::ok(body),
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn note_save(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    stem: String,
    body: String,
    rewrite_on_exit: bool,
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

    match svc.note_save(&stem, &body, rewrite_on_exit) {
        Ok(()) => CommandResult::ok(()),
        Err(e) => {
            #[cfg(debug_assertions)]
            eprintln!(
                "[ponder][note_save] command failed code={} stem='{}' rewrite_on_exit={} bytes={} msg={}",
                map_error_code(&e),
                stem,
                rewrite_on_exit,
                body.as_bytes().len(),
                e
            );

            CommandResult::err(map_error_code(&e), e.to_string())
        }
    }
}

#[tauri::command]
pub fn note_discard(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
    stem: String,
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

    match svc.note_discard(&stem) {
        Ok(()) => CommandResult::ok(()),
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
        WorkspaceServiceError::Io(_) => "io_error",
        WorkspaceServiceError::Json(_) => "json_error",
        WorkspaceServiceError::Config(_) => "config_error",
        WorkspaceServiceError::InvalidTodoToggle(_) => "invalid_todo_toggle",
        WorkspaceServiceError::NoteNotFound => "note_not_found",
    }
}
