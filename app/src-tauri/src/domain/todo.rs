use thiserror::Error;

pub struct TodoItem {
    pub text: String,
    pub checked: bool,
    pub note_stem: String,
    pub line_number: usize,
    pub char_offset: usize,
}

#[derive(Debug, Error)]
pub enum ToggleError {
    #[error("checkbox not found at specified location")]
    CheckboxNotFound,
    #[error("io error: {0}")]
    IoError(#[from] std::io::Error),
}

pub fn extract_todos(_stem: &str, _body: &str) -> Vec<TodoItem> {
    // Placeholder implementation - tests will fail
    Vec::new()
}

pub fn toggle_checkbox_in_memory(
    _body: &str,
    _line_number: usize,
    _char_offset: usize,
) -> Result<(String, bool), ToggleError> {
    // Placeholder - will fail tests
    Err(ToggleError::CheckboxNotFound)
}

#[cfg(test)]
mod tests;
