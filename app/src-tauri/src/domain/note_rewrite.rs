pub fn rewrite_exit_checklists(body: &str) -> String {
    let mut in_fence = false;
    let mut output = String::with_capacity(body.len());

    for segment in body.split_inclusive('\n') {
        let (line, newline) = match segment.strip_suffix('\n') {
            Some(without_newline) => (without_newline, "\n"),
            None => (segment, ""),
        };
        let (indentation, content) = split_indentation(line);

        if is_fence_toggle(content) {
            in_fence = !in_fence;
            output.push_str(line);
            output.push_str(newline);
            continue;
        }

        if in_fence || is_blockquote(content) {
            output.push_str(line);
            output.push_str(newline);
            continue;
        }

        if let Some(rest) = checklist_rest(content) {
            output.push_str(indentation);
            output.push_str("[ ] ");
            output.push_str(rest);
            output.push_str(newline);
            continue;
        }

        output.push_str(line);
        output.push_str(newline);
    }

    output
}

fn split_indentation(line: &str) -> (&str, &str) {
    let mut idx = 0;
    for byte in line.as_bytes() {
        if *byte == b' ' {
            idx += 1;
        } else {
            break;
        }
    }

    line.split_at(idx)
}

fn is_fence_toggle(content: &str) -> bool {
    content.starts_with("```") || content.starts_with("~~~")
}

fn is_blockquote(content: &str) -> bool {
    content.starts_with('>')
}

fn checklist_rest(content: &str) -> Option<&str> {
    let rest = content.strip_prefix("o ").or_else(|| content.strip_prefix("O "))?;

    if rest.trim().is_empty() {
        return None;
    }

    Some(rest)
}

#[cfg(test)]
mod tests {
    use super::rewrite_exit_checklists;

    #[test]
    fn rewrites_basic_and_indented_lines() {
        let input = "o task\n  O another\n    o third";
        let expected = "[ ] task\n  [ ] another\n    [ ] third";

        assert_eq!(rewrite_exit_checklists(input), expected);
    }

    #[test]
    fn skips_empty_or_tabbed_markers() {
        let input = "o \nO \n\to task\n  o\tTabbed";
        let expected = "o \nO \n\to task\n  o\tTabbed";

        assert_eq!(rewrite_exit_checklists(input), expected);
    }

    #[test]
    fn skips_blockquotes_after_indentation() {
        let input = "  > o quoted\no plain";
        let expected = "  > o quoted\n[ ] plain";

        assert_eq!(rewrite_exit_checklists(input), expected);
    }

    #[test]
    fn skips_fenced_code_blocks() {
        let input = "o outside\n```\no inside\n```\nO after\n  ~~~\n  o fenced\n  ~~~";
        let expected = "[ ] outside\n```\no inside\n```\n[ ] after\n  ~~~\n  o fenced\n  ~~~";

        assert_eq!(rewrite_exit_checklists(input), expected);
    }
}
