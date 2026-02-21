import { afterEach, describe, expect, it } from 'vitest'
import {
  readOverviewCompactPreference,
  writeOverviewCompactPreference,
} from './overviewCompactPreference'

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

function setTestWindow(storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage } as Window,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    return
  }

  Reflect.deleteProperty(globalThis, 'window')
})

describe('overviewCompactPreference', () => {
  it('returns false when window is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'window')
    expect(readOverviewCompactPreference()).toBe(false)
  })

  it('reads true only when stored value is exactly "true"', () => {
    const values = new Map<string, string | null>([['ponder.overview.compact', 'true']])
    setTestWindow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    })
    expect(readOverviewCompactPreference()).toBe(true)

    values.set('ponder.overview.compact', 'false')
    expect(readOverviewCompactPreference()).toBe(false)

    values.set('ponder.overview.compact', 'unexpected')
    expect(readOverviewCompactPreference()).toBe(false)

    values.delete('ponder.overview.compact')
    expect(readOverviewCompactPreference()).toBe(false)
  })

  it('writes "true" and "false" string values', () => {
    const values = new Map<string, string | null>()
    setTestWindow({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    })

    writeOverviewCompactPreference(true)
    expect(values.get('ponder.overview.compact')).toBe('true')

    writeOverviewCompactPreference(false)
    expect(values.get('ponder.overview.compact')).toBe('false')
  })

  it('returns false if storage read throws', () => {
    setTestWindow({
      getItem: () => {
        throw new Error('read failure')
      },
      setItem: () => undefined,
    })

    expect(readOverviewCompactPreference()).toBe(false)
  })

  it('does not throw if storage write throws', () => {
    setTestWindow({
      getItem: () => null,
      setItem: () => {
        throw new Error('write failure')
      },
    })

    expect(() => writeOverviewCompactPreference(true)).not.toThrow()
  })
})
