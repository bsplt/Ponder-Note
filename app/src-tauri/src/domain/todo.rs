use regex::Regex;
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

pub fn extract_todos(stem: &str, body: &str) -> Vec<TodoItem> {
    // GFM task list: optional spaces, optional list marker, [ ] or [x]/[X]
    let checkbox_re = Regex::new(
        r"^(?P<indent>\s*)(?:[-*+]\s+)?(?P<checkbox>\[(?P<state>[ xX])\])\s+(?P<text>.+)$"
    ).unwrap();
    
    let mut todos = Vec::new();
    let mut in_fence = false;
    
    for (line_num, line) in body.lines().enumerate() {
        // Skip fenced code blocks (like rewrite_exit_checklists does)
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        
        // Skip content inside fences or blockquotes
        if in_fence || trimmed.starts_with('>') {
            continue;
        }
        
        if let Some(caps) = checkbox_re.captures(line) {
            let state = caps.name("state").unwrap().as_str();
            let checkbox_start = caps.name("checkbox").unwrap().start();
            let text = caps.name("text").unwrap().as_str();
            
            todos.push(TodoItem {
                text: text.to_string(),
                checked: state != " ",
                note_stem: stem.to_string(),
                line_number: line_num,
                char_offset: checkbox_start,
            });
        }
    }
    
    todos
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
    
    // Extract 3-char substring at offset and toggle it
    let checkbox = &line[char_offset..char_offset + 3];
    let new_checkbox = match_and_toggle_checkbox(checkbox)?;
    let new_checked = new_checkbox == "[x]";
    
    // Build new line with replaced checkbox
    let new_line = format!(
        "{}{}{}",
        &line[..char_offset],
        new_checkbox,
        &line[char_offset + 3..]
    );
    
    // Rebuild body with modified line
    let new_body: String = lines
        .iter()
        .enumerate()
        .map(|(i, &l)| {
            if i == line_number {
                new_line.as_str()
            } else {
                l
            }
        })
        .collect::<Vec<&str>>()
        .join("\n");
    
    Ok((new_body, new_checked))
}

fn match_and_toggle_checkbox(checkbox: &str) -> Result<&'static str, ToggleError> {
    match checkbox {
        "[ ]" => Ok("[x]"),
        "[x]" | "[X]" => Ok("[ ]"),
        _ => Err(ToggleError::CheckboxNotFound),
    }
}

#[cfg(test)]
mod tests;
