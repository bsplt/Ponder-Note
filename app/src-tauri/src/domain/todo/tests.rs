use super::*;

// ============================================================================
// Todo Extraction Tests
// ============================================================================

#[test]
fn basic_unchecked_checkbox() {
    let body = "- [ ] buy milk";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "buy milk");
    assert_eq!(todos[0].checked, false);
    assert_eq!(todos[0].note_stem, "test");
    assert_eq!(todos[0].line_number, 0);
    assert_eq!(todos[0].char_offset, 2);
}

#[test]
fn basic_checked_checkbox_lowercase() {
    let body = "- [x] buy eggs";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "buy eggs");
    assert_eq!(todos[0].checked, true);
    assert_eq!(todos[0].note_stem, "test");
    assert_eq!(todos[0].line_number, 0);
    assert_eq!(todos[0].char_offset, 2);
}

#[test]
fn basic_checked_checkbox_uppercase() {
    let body = "- [X] buy bread";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "buy bread");
    assert_eq!(todos[0].checked, true);
    assert_eq!(todos[0].note_stem, "test");
    assert_eq!(todos[0].line_number, 0);
    assert_eq!(todos[0].char_offset, 2);
}

#[test]
fn checkbox_without_list_marker() {
    let body = "[ ] standalone checkbox";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "standalone checkbox");
    assert_eq!(todos[0].checked, false);
    assert_eq!(todos[0].note_stem, "test");
    assert_eq!(todos[0].line_number, 0);
    assert_eq!(todos[0].char_offset, 0);
}

#[test]
fn checkbox_with_leading_whitespace() {
    let body = "  - [ ] indented task";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "indented task");
    assert_eq!(todos[0].checked, false);
    assert_eq!(todos[0].note_stem, "test");
    assert_eq!(todos[0].line_number, 0);
    assert_eq!(todos[0].char_offset, 4);
}

#[test]
fn skip_fenced_code_blocks() {
    let body = "```\n- [ ] not a todo\n```\n- [ ] real todo";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "real todo");
    assert_eq!(todos[0].line_number, 3);
}

#[test]
fn skip_blockquotes() {
    let body = "> - [ ] quoted\n- [ ] real todo";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].text, "real todo");
    assert_eq!(todos[0].line_number, 1);
}

#[test]
fn multiple_todos() {
    let body = "- [ ] first\n- [x] second\n- [ ] third";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 3);
    assert_eq!(todos[0].text, "first");
    assert_eq!(todos[0].checked, false);
    assert_eq!(todos[0].line_number, 0);
    
    assert_eq!(todos[1].text, "second");
    assert_eq!(todos[1].checked, true);
    assert_eq!(todos[1].line_number, 1);
    
    assert_eq!(todos[2].text, "third");
    assert_eq!(todos[2].checked, false);
    assert_eq!(todos[2].line_number, 2);
}

#[test]
fn character_offset_precision() {
    let body = "    - [ ] deeply indented";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 1);
    assert_eq!(todos[0].char_offset, 6); // 4 spaces + "- "
}

#[test]
fn empty_note() {
    let body = "";
    let todos = extract_todos("test", body);
    
    assert_eq!(todos.len(), 0);
}

// ============================================================================
// Todo Toggle Tests
// ============================================================================

#[test]
fn toggle_unchecked_to_checked() {
    let body = "- [ ] task";
    let result = toggle_checkbox_in_memory(body, 0, 2);
    
    assert!(result.is_ok());
    let (new_body, new_checked) = result.unwrap();
    assert_eq!(new_body, "- [x] task");
    assert_eq!(new_checked, true);
}

#[test]
fn toggle_checked_to_unchecked() {
    let body = "- [x] task";
    let result = toggle_checkbox_in_memory(body, 0, 2);
    
    assert!(result.is_ok());
    let (new_body, new_checked) = result.unwrap();
    assert_eq!(new_body, "- [ ] task");
    assert_eq!(new_checked, false);
}

#[test]
fn toggle_uppercase_x_to_unchecked() {
    let body = "- [X] task";
    let result = toggle_checkbox_in_memory(body, 0, 2);
    
    assert!(result.is_ok());
    let (new_body, new_checked) = result.unwrap();
    assert_eq!(new_body, "- [ ] task");
    assert_eq!(new_checked, false);
}

#[test]
fn error_line_number_out_of_bounds() {
    let body = "- [ ] task";
    let result = toggle_checkbox_in_memory(body, 5, 2);
    
    assert!(result.is_err());
    match result.unwrap_err() {
        ToggleError::CheckboxNotFound => {}
        _ => panic!("Expected CheckboxNotFound error"),
    }
}

#[test]
fn error_char_offset_out_of_bounds() {
    let body = "- [ ] task";
    let result = toggle_checkbox_in_memory(body, 0, 100);
    
    assert!(result.is_err());
    match result.unwrap_err() {
        ToggleError::CheckboxNotFound => {}
        _ => panic!("Expected CheckboxNotFound error"),
    }
}

#[test]
fn error_no_checkbox_at_position() {
    let body = "plain text";
    let result = toggle_checkbox_in_memory(body, 0, 0);
    
    assert!(result.is_err());
    match result.unwrap_err() {
        ToggleError::CheckboxNotFound => {}
        _ => panic!("Expected CheckboxNotFound error"),
    }
}

#[test]
fn error_wrong_pattern_at_position() {
    let body = "- [?] malformed";
    let result = toggle_checkbox_in_memory(body, 0, 2);
    
    assert!(result.is_err());
    match result.unwrap_err() {
        ToggleError::CheckboxNotFound => {}
        _ => panic!("Expected CheckboxNotFound error"),
    }
}

#[test]
fn multiline_note_toggle() {
    let body = "# Title\n- [ ] todo\nMore text";
    let result = toggle_checkbox_in_memory(body, 1, 2);
    
    assert!(result.is_ok());
    let (new_body, new_checked) = result.unwrap();
    assert_eq!(new_body, "# Title\n- [x] todo\nMore text");
    assert_eq!(new_checked, true);
}

#[test]
fn preserve_indentation() {
    let body = "  - [ ] indented";
    let result = toggle_checkbox_in_memory(body, 0, 4);
    
    assert!(result.is_ok());
    let (new_body, new_checked) = result.unwrap();
    assert_eq!(new_body, "  - [x] indented");
    assert_eq!(new_checked, true);
}

#[test]
fn preserve_surrounding_text() {
    let body = "prefix - [ ] task suffix";
    let result = toggle_checkbox_in_memory(body, 0, 9);
    
    assert!(result.is_ok());
    let (new_body, new_checked) = result.unwrap();
    assert_eq!(new_body, "prefix - [x] task suffix");
    assert_eq!(new_checked, true);
}
