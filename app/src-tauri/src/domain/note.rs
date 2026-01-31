use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSidecar {
    pub title: String,
    pub created_at: i64,
    pub updated_at: Option<i64>,
    pub tags: Option<Vec<String>>,
    #[serde(flatten)]
    #[serde(default)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub stem: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub filename: String,
}
