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
    body: &str,
    line_number: usize,
    char_offset: usize,
) -> Result<(String, bool), ToggleError> {
    // Split body into lines
    let lines: Vec<&str> = body.split('\n').collect();
    
    // Verify line_number is in bounds
    if line_number >= lines.len() {
        return Err(ToggleError::CheckboxNotFound);
    }
    
    let line = lines[line_number];
    
    // Verify char_offset + 3 is in bounds (need 3 chars for checkbox)
    if char_offset + 3 > line.len() {
        return Err(ToggleError::CheckboxNotFound);
    }
    
    // Extract 3-char substring at offset
    let checkbox = &line[char_offset..char_offset + 3];
    
    // Match against valid checkbox patterns and determine new state
    let new_checkbox = match checkbox {
        "[ ]" => "[x]",
        "[x]" | "[X]" => "[ ]",
        _ => return Err(ToggleError::CheckboxNotFound),
    };
    
    // Determine new checked state
    let new_checked = new_checkbox == "[x]";
    
    // Build new line with replaced checkbox
    let mut new_line = String::with_capacity(line.len());
    new_line.push_str(&line[..char_offset]);
    new_line.push_str(new_checkbox);
    new_line.push_str(&line[char_offset + 3..]);
    
    // Rebuild body with modified line
    let mut new_lines = lines;
    new_lines[line_number] = &new_line;
    let new_body = new_lines.join("\n");
    
    Ok((new_body, new_checked))
}

#[cfg(test)]
mod tests;
