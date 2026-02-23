import { describe, expect, it } from 'vitest'
import { noteColorSlot } from './noteColor'

function oldNoteColorSlot(stem: string): number {
  let hash = 0
  for (let i = 0; i < stem.length; i++) {
    hash = ((hash << 5) - hash + stem.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 16) + 1
}

describe('noteColorSlot', () => {
  it('returns integer slots from 2 to 17', () => {
    const stems = [
      '',
      'alpha',
      'beta',
      'My Note',
      '2026-02-23',
      'inbox',
      'project-x',
      'z',
      'aaaaaaaaaaaaaaaa',
    ]

    for (const stem of stems) {
      const slot = noteColorSlot(stem)
      expect(Number.isInteger(slot)).toBe(true)
      expect(slot).toBeGreaterThanOrEqual(2)
      expect(slot).toBeLessThanOrEqual(17)
    }
  })

  it('is deterministic for repeated calls', () => {
    const stems = ['', 'alpha', 'beta', 'My Note', '2026-02-23']

    for (const stem of stems) {
      const first = noteColorSlot(stem)
      for (let i = 0; i < 5; i++) {
        expect(noteColorSlot(stem)).toBe(first)
      }
    }
  })

  it('shifts every old slot by +1', () => {
    const stems = ['', 'alpha', 'beta', 'My Note', '2026-02-23', 'workspace', 'todo-1']

    for (const stem of stems) {
      expect(noteColorSlot(stem)).toBe(oldNoteColorSlot(stem) + 1)
    }
  })
})
