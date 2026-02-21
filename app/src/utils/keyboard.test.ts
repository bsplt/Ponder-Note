import { describe, expect, it } from 'vitest'
import { getGlobalNavAction, type GlobalShortcutInput } from './keyboard'

function makeInput(overrides: Partial<GlobalShortcutInput> = {}): GlobalShortcutInput {
  return {
    screen: 'overview',
    key: 'o',
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    ...overrides,
  }
}

describe('getGlobalNavAction', () => {
  it('maps h to shortcuts', () => {
    expect(getGlobalNavAction(makeInput({ key: 'h' }))).toBe('shortcuts')
  })

  it('maps ? to shortcuts', () => {
    expect(getGlobalNavAction(makeInput({ key: '?' }))).toBe('shortcuts')
  })

  it('keeps existing global mappings', () => {
    expect(getGlobalNavAction(makeInput({ key: 'o' }))).toBe('overview')
    expect(getGlobalNavAction(makeInput({ key: 'w' }))).toBe('workspaces')
    expect(getGlobalNavAction(makeInput({ key: 't' }))).toBe('todolist')
    expect(getGlobalNavAction(makeInput({ key: 'n' }))).toBe('new-note')
  })

  it('returns null when screen is editor', () => {
    expect(getGlobalNavAction(makeInput({ key: 'h', screen: 'editor' }))).toBeNull()
  })

  it('returns null for typing targets', () => {
    expect(
      getGlobalNavAction(
        makeInput({
          key: 'h',
          target: { tagName: 'input' } as unknown as EventTarget,
        }),
      ),
    ).toBeNull()
  })

  it('returns null for repeat and modifier keys', () => {
    expect(getGlobalNavAction(makeInput({ key: 'h', repeat: true }))).toBeNull()
    expect(getGlobalNavAction(makeInput({ key: 'h', metaKey: true }))).toBeNull()
    expect(getGlobalNavAction(makeInput({ key: 'h', ctrlKey: true }))).toBeNull()
    expect(getGlobalNavAction(makeInput({ key: 'h', altKey: true }))).toBeNull()
  })
})
