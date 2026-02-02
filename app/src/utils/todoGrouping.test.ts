import { describe, it, expect } from 'vitest'
import { groupTodosByTags, type TodoItem, type NoteSummary, type TodoGroup } from './todoGrouping'

describe('groupTodosByTags', () => {
  it('groups todos from a single-tag note', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
      { text: 'task2', checked: false, noteStem: 'noteA', lineNumber: 2, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: 1000, tags: ['work'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      tag: 'work',
      todos: [
        { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
        { text: 'task2', checked: false, noteStem: 'noteA', lineNumber: 2, charOffset: 0 },
      ],
      mostRecentEdit: 1000,
    })
  })

  it('creates cross-group appearance for multi-tag notes', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: 1000, tags: ['work', 'urgent'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(2)
    expect(result.find((g) => g.tag === 'work')).toEqual({
      tag: 'work',
      todos: [{ text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 }],
      mostRecentEdit: 1000,
    })
    expect(result.find((g) => g.tag === 'urgent')).toEqual({
      tag: 'urgent',
      todos: [{ text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 }],
      mostRecentEdit: 1000,
    })
  })

  it('creates Untagged group for notes without tags', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: 1000, tags: [] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      tag: 'Untagged',
      todos: [{ text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 }],
      mostRecentEdit: 1000,
    })
  })

  it('orders groups by most recent activity', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
      { text: 'task2', checked: false, noteStem: 'noteB', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: 1000, tags: ['work'] },
      { stem: 'noteB', title: 'Note B', createdAt: 2000, updatedAt: 2000, tags: ['personal'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(2)
    expect(result[0].tag).toBe('personal')
    expect(result[0].mostRecentEdit).toBe(2000)
    expect(result[1].tag).toBe('work')
    expect(result[1].mostRecentEdit).toBe(1000)
  })

  it('orders todos within group by note recency', () => {
    const todos: TodoItem[] = [
      { text: 'taskA', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
      { text: 'taskB', checked: false, noteStem: 'noteB', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: 1000, tags: ['work'] },
      { stem: 'noteB', title: 'Note B', createdAt: 2000, updatedAt: 2000, tags: ['work'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(1)
    expect(result[0].tag).toBe('work')
    expect(result[0].todos[0].text).toBe('taskB') // More recent note first
    expect(result[0].todos[1].text).toBe('taskA')
    expect(result[0].mostRecentEdit).toBe(2000)
  })

  it('places Untagged group at bottom regardless of recency', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
      { text: 'task2', checked: false, noteStem: 'noteB', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 2000, updatedAt: 2000, tags: ['work'] },
      { stem: 'noteB', title: 'Note B', createdAt: 3000, updatedAt: 3000, tags: [] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(2)
    expect(result[0].tag).toBe('work')
    expect(result[1].tag).toBe('Untagged')
    expect(result[1].mostRecentEdit).toBe(3000) // Has more recent edit but still last
  })

  it('uses createdAt fallback when updatedAt is null', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: null, tags: ['work'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(1)
    expect(result[0].mostRecentEdit).toBe(1000) // Uses createdAt
  })

  it('returns empty array for empty todos', () => {
    const todos: TodoItem[] = []
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Note A', createdAt: 1000, updatedAt: 1000, tags: ['work'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toEqual([])
  })

  it('skips orphan todos without matching notes', () => {
    const todos: TodoItem[] = [
      { text: 'task1', checked: false, noteStem: 'missing', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = []

    const result = groupTodosByTags(todos, notes)

    expect(result).toEqual([])
  })

  it('ensures sort stability with same updatedAt (alphabetical by title)', () => {
    const todos: TodoItem[] = [
      { text: 'taskA', checked: false, noteStem: 'noteA', lineNumber: 1, charOffset: 0 },
      { text: 'taskB', checked: false, noteStem: 'noteB', lineNumber: 1, charOffset: 0 },
    ]
    const notes: NoteSummary[] = [
      { stem: 'noteA', title: 'Zebra', createdAt: 1000, updatedAt: 1000, tags: ['work'] },
      { stem: 'noteB', title: 'Alpha', createdAt: 1000, updatedAt: 1000, tags: ['work'] },
    ]

    const result = groupTodosByTags(todos, notes)

    expect(result).toHaveLength(1)
    expect(result[0].todos[0].text).toBe('taskB') // Alpha before Zebra
    expect(result[0].todos[1].text).toBe('taskA')
  })
})
