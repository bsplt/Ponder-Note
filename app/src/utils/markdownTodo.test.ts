import { describe, expect, it } from 'vitest'
import { extractMarkdownTodos, normalizePreviewTodoLines, toggleMarkdownTodoInBody } from './markdownTodo'

describe('extractMarkdownTodos', () => {
  it('extracts unchecked markdown todo', () => {
    const todos = extractMarkdownTodos('- [ ] buy milk')
    const todo = todos.get(0)

    expect(todo).toEqual({
      text: 'buy milk',
      checked: false,
      lineNumber: 0,
      charOffset: 2,
    })
  })

  it('extracts checked lowercase markdown todo (- [x])', () => {
    const todos = extractMarkdownTodos('- [x] buy eggs')
    const todo = todos.get(0)

    expect(todo).toEqual({
      text: 'buy eggs',
      checked: true,
      lineNumber: 0,
      charOffset: 2,
    })
  })

  it('extracts checked uppercase markdown todo (- [X])', () => {
    const todos = extractMarkdownTodos('- [X] buy bread')
    const todo = todos.get(0)

    expect(todo).toEqual({
      text: 'buy bread',
      checked: true,
      lineNumber: 0,
      charOffset: 2,
    })
  })

  it('extracts standalone checkbox markdown todo ([ ] without list marker)', () => {
    const todos = extractMarkdownTodos('[ ] standalone task')
    const todo = todos.get(0)

    expect(todo).toEqual({
      text: 'standalone task',
      checked: false,
      lineNumber: 0,
      charOffset: 0,
    })
  })

  it('skips fenced code and blockquote todos', () => {
    const body = '```\n- [ ] hidden\n```\n- [ ] visible\n> - [ ] quoted'
    const todos = extractMarkdownTodos(body)

    expect(todos.size).toBe(1)
    expect(todos.get(3)?.text).toBe('visible')
  })
})

describe('toggleMarkdownTodoInBody', () => {
  it('toggles - [ ] to - [x]', () => {
    const result = toggleMarkdownTodoInBody('- [ ] task', 0, 2)
    expect(result.body).toBe('- [x] task')
    expect(result.checked).toBe(true)
  })

  it('toggles - [x] to - [ ]', () => {
    const result = toggleMarkdownTodoInBody('- [x] task', 0, 2)
    expect(result.body).toBe('- [ ] task')
    expect(result.checked).toBe(false)
  })

  it('toggles - [X] to - [ ]', () => {
    const result = toggleMarkdownTodoInBody('- [X] task', 0, 2)
    expect(result.body).toBe('- [ ] task')
    expect(result.checked).toBe(false)
  })
})

describe('normalizePreviewTodoLines', () => {
  it('normalizes standalone checkboxes to list-task syntax', () => {
    const input = '[ ] one\n[x] two\n[X] three'
    const output = normalizePreviewTodoLines(input)

    expect(output).toBe('- [ ] one\n- [x] two\n- [X] three')
  })

  it('preserves surrounding plain text while normalizing adjacent todo lines', () => {
    const input = 'plain before\n[ ] one\n[ ] two\nplain after'
    const output = normalizePreviewTodoLines(input)

    expect(output).toBe('plain before\n- [ ] one\n- [ ] two\nplain after')
  })

  it('does not normalize checkboxes inside fences or blockquotes', () => {
    const input = '```\n[ ] hidden\n```\n> [ ] quoted\n[ ] visible'
    const output = normalizePreviewTodoLines(input)

    expect(output).toBe('```\n[ ] hidden\n```\n> [ ] quoted\n- [ ] visible')
  })
})
