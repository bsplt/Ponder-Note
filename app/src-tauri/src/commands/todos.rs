use crate::services::workspace_service::WorkspaceService;
use crate::domain::todo::TodoItem;
use crate::domain::workspace::CommandResult;
use crate::services::workspace_service::{WorkspaceServiceError, InvalidWorkspaceKind};
use std::sync::Mutex;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItemDto {
    pub text: String,
    pub checked: bool,
    pub note_stem: String,
    pub line_number: usize,
    pub char_offset: usize,
}

impl From<TodoItem> for TodoItemDto {
    fn from(item: TodoItem) -> Self {
        Self {
            text: item.text,
            checked: item.checked,
            note_stem: item.note_stem,
            line_number: item.line_number,
            char_offset: item.char_offset,
        }
    }
}

#[tauri::command]
pub fn list_todos(
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<Vec<TodoItemDto>> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.list_todos() {
        Ok(items) => {
            let dtos: Vec<TodoItemDto> = items.into_iter().map(TodoItemDto::from).collect();
            CommandResult::ok(dtos)
        }
        Err(e) => CommandResult::err(map_error_code(&e), e.to_string()),
    }
}

#[tauri::command]
pub fn toggle_todo(
    stem: String,
    line_number: usize,
    char_offset: usize,
    service: tauri::State<'_, Mutex<WorkspaceService>>,
) -> CommandResult<bool> {
    let svc = match service.lock() {
        Ok(s) => s,
        Err(_) => {
            return CommandResult::err(
                "internal_lock_poisoned",
                "Workspace state is temporarily unavailable",
            )
        }
    };

    match svc.toggle_todo(&stem, line_number, char_offset) {
        Ok(new_state) => CommandResult::ok(new_state),
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
