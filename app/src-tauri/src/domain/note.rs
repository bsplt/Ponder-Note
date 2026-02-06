use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct NoteSidecar {
    pub title: String,
    #[serde(alias = "createdAt")]
    pub created_at: i64,
    #[serde(alias = "updatedAt")]
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
    /// Full note body for search; not displayed in the overview list.
    #[serde(default)]
    pub preview: String,
}

#[cfg(test)]
mod tests {
    use super::NoteSidecar;

    #[test]
    fn note_sidecar_serializes_snake_case_fields() {
        let sidecar = NoteSidecar {
            title: "Test".to_string(),
            created_at: 1700000000000,
            updated_at: Some(1700000000123),
            tags: Some(vec!["alpha".to_string(), "beta".to_string()]),
            extra: Default::default(),
        };

        let json = serde_json::to_string(&sidecar).expect("serialize NoteSidecar");

        assert!(json.contains("\"created_at\""));
        assert!(!json.contains("\"createdAt\""));
        assert!(json.contains("\"updated_at\""));
        assert!(!json.contains("\"updatedAt\""));
    }

    #[test]
    fn note_sidecar_deserializes_legacy_camel_case_fields() {
        let raw = r#"{"title":"Legacy","createdAt":1700000000000,"updatedAt":1700000000456,"tags":["legacy"]}"#;
        let sidecar: NoteSidecar = serde_json::from_str(raw).expect("deserialize NoteSidecar");

        assert_eq!(sidecar.title, "Legacy");
        assert_eq!(sidecar.created_at, 1700000000000);
        assert_eq!(sidecar.updated_at, Some(1700000000456));
        assert_eq!(sidecar.tags, Some(vec!["legacy".to_string()]));
    }
}
