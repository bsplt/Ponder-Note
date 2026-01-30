use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub workspaces: [Option<String>; 9],
    pub active_slot: u8,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            workspaces: Default::default(),
            active_slot: 1,
        }
    }
}

pub fn slot_to_index(slot: u8) -> Option<usize> {
    if (1..=9).contains(&slot) {
        Some((slot - 1) as usize)
    } else {
        None
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
