pub fn derive_note_title(first_line: &str) -> String {
    let mut line = first_line.replace('\t', " ");
    line = line.trim().to_string();

    if line.is_empty() {
        return "Untitled".to_string();
    }

    line = strip_heading_markers(&line);

    if line.is_empty() || line == "---" {
        return "Untitled".to_string();
    }

    line = strip_checkbox_prefix(&line);
    line = strip_list_or_quote_prefix(&line);
    line = line.trim().to_string();

    if line.is_empty() {
        return "Untitled".to_string();
    }

    line = strip_markdown_links(&line);
    line = strip_inline_formatting(&line);
    line = line.trim().to_string();

    if line.is_empty() {
        return "Untitled".to_string();
    }

    line
}

fn strip_heading_markers(input: &str) -> String {
    let mut start = 0;
    for (idx, ch) in input.char_indices() {
        if ch == '#' {
            start = idx + ch.len_utf8();
        } else {
            break;
        }
    }

    input[start..].trim().to_string()
}

fn strip_checkbox_prefix(input: &str) -> String {
    let lower = input.to_ascii_lowercase();
    for prefix in ["- [ ]", "- [x]"] {
        if lower.starts_with(prefix) {
            let trimmed = input[prefix.len()..].trim_start();
            return trimmed.to_string();
        }
    }

    input.to_string()
}

fn strip_list_or_quote_prefix(input: &str) -> String {
    if let Some(stripped) = input.strip_prefix("- ") {
        return stripped.trim_start().to_string();
    }

    if let Some(stripped) = input.strip_prefix("* ") {
        return stripped.trim_start().to_string();
    }

    if let Some(stripped) = input.strip_prefix("> ") {
        return stripped.trim_start().to_string();
    }

    let mut chars = input.char_indices();
    let mut end_digits = 0;
    for (idx, ch) in &mut chars {
        if ch.is_ascii_digit() {
            end_digits = idx + ch.len_utf8();
        } else {
            break;
        }
    }

    if end_digits > 0 {
        if input[end_digits..].starts_with(". ") {
            return input[end_digits + 2..].trim_start().to_string();
        }
    }

    input.to_string()
}

fn strip_markdown_links(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut idx = 0;

    while idx < input.len() {
        let ch = input[idx..].chars().next().unwrap();
        let ch_len = ch.len_utf8();

        if ch == '[' {
            if let Some(close_rel) = input[idx + ch_len..].find(']') {
                let close_idx = idx + ch_len + close_rel;
                if input[close_idx + 1..].starts_with('(') {
                    if let Some(end_rel) = input[close_idx + 2..].find(')') {
                        let end_idx = close_idx + 2 + end_rel;
                        out.push_str(&input[idx + ch_len..close_idx]);
                        idx = end_idx + 1;
                        continue;
                    }
                }
            }
        }

        out.push(ch);
        idx += ch_len;
    }

    out
}

fn strip_inline_formatting(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut idx = 0;

    while idx < chars.len() {
        let ch = chars[idx];

        if ch == '`' {
            idx += 1;
            continue;
        }

        if ch == '*' || ch == '_' {
            let marker = ch;
            let mut end = idx + 1;
            while end < chars.len() && chars[end] == marker {
                end += 1;
            }

            let prev = if idx == 0 { None } else { Some(chars[idx - 1]) };
            let next = if end >= chars.len() { None } else { Some(chars[end]) };
            let prev_space = prev.map(|c| c.is_whitespace()).unwrap_or(true);
            let next_space = next.map(|c| c.is_whitespace()).unwrap_or(true);
            let is_open = prev_space && !next_space;
            let is_close = !prev_space && next_space;

            if is_open || is_close {
                idx = end;
                continue;
            }
        }

        out.push(ch);
        idx += 1;
    }

    out
}
