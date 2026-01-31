pub fn rewrite_exit_checklists(body: &str) -> String {
    body.to_string()
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
