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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RebuildSummary {
    pub started_at: i64,
    pub finished_at: i64,
    pub duration_ms: i64,
    pub counts: RebuildCounts,
    pub error_count: usize,
}

impl RebuildLog {
    pub fn summary(&self) -> RebuildSummary {
        RebuildSummary {
            started_at: self.started_at,
            finished_at: self.finished_at,
            duration_ms: self.finished_at.saturating_sub(self.started_at),
            counts: self.counts.clone(),
            error_count: self.errors.len(),
        }
    }
}
