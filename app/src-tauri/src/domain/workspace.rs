use serde::de::Deserializer;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default, deserialize_with = "deserialize_workspaces")]
    pub workspaces: [Option<String>; 9],

    #[serde(default = "default_active_slot")]
    pub active_slot: u8,

    // Preserve any other config fields not owned by the workspace subsystem.
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            workspaces: Default::default(),
            active_slot: 1,
            extra: BTreeMap::new(),
        }
    }
}

fn default_active_slot() -> u8 {
    1
}

fn deserialize_workspaces<'de, D>(deserializer: D) -> Result<[Option<String>; 9], D::Error>
where
    D: Deserializer<'de>,
{
    let v: Option<Vec<Option<String>>> = Option::deserialize(deserializer)?;
    let mut out: [Option<String>; 9] = Default::default();

    if let Some(v) = v {
        for (idx, item) in v.into_iter().take(9).enumerate() {
            out[idx] = item;
        }
    }

    Ok(out)
}

pub fn slot_to_index(slot: u8) -> Option<usize> {
    if (1..=9).contains(&slot) {
        Some((slot - 1) as usize)
    } else {
        None
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceFolderStatus {
    Unassigned,
    Ok,
    Missing,
    Unreadable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSlotState {
    pub slot: u8,
    pub path: Option<String>,
    // Only populated for the active slot.
    pub status: Option<WorkspaceFolderStatus>,
    // Only populated for the active slot, when it is in an error state.
    pub error_kind: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub active_slot: u8,
    pub fallback_slot: Option<u8>,
    pub slots: [WorkspaceSlotState; 9],
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult<T> {
    pub ok: bool,
    pub value: Option<T>,
    pub error: Option<CommandError>,
}

impl<T> CommandResult<T> {
    pub fn ok(value: T) -> Self {
        Self {
            ok: true,
            value: Some(value),
            error: None,
        }
    }

    pub fn err(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            ok: false,
            value: None,
            error: Some(CommandError {
                code: code.into(),
                message: message.into(),
            }),
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slot_to_index_maps_1_to_0_and_9_to_8() {
        assert_eq!(slot_to_index(1), Some(0));
        assert_eq!(slot_to_index(9), Some(8));
    }

    #[test]
    fn slot_to_index_rejects_out_of_range() {
        assert_eq!(slot_to_index(0), None);
        assert_eq!(slot_to_index(10), None);
    }
}
