mod commands;
mod domain;
mod services;
mod storage;

use crate::commands::notes::{note_discard, note_read, note_save};
use crate::commands::workspace::{
    workspace_assign_slot, workspace_create_note, workspace_get_state, workspace_list_notes,
    workspace_list_root_notes, workspace_switch_slot,
};
use crate::services::workspace_service::WorkspaceService;
use crate::storage::app_config_repo::AppConfigRepo;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let workspace_service = WorkspaceService::new(AppConfigRepo)
        .expect("failed to initialize workspace service");

    tauri::Builder::default()
        .manage(Mutex::new(workspace_service))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            workspace_get_state,
            workspace_assign_slot,
            workspace_switch_slot,
            workspace_list_root_notes,
            workspace_list_notes,
            workspace_create_note,
            note_read,
            note_save,
            note_discard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
