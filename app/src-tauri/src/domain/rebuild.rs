use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RebuildCounts {
    pub notes_scanned: usize,
    pub sidecars_created: usize,
    pub sidecars_repaired: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_stem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildLog {
    pub started_at: i64,
    pub finished_at: i64,
    pub workspace_path: String,
    pub counts: RebuildCounts,
    pub errors: Vec<RebuildError>,
}
