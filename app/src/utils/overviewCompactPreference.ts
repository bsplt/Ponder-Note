const OVERVIEW_COMPACT_STORAGE_KEY = 'ponder.overview.compact'

function hasWindow(): boolean {
  return typeof window !== 'undefined'
}

export function readOverviewCompactPreference(): boolean {
  if (!hasWindow()) return false

  try {
    return window.localStorage.getItem(OVERVIEW_COMPACT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeOverviewCompactPreference(value: boolean): void {
  if (!hasWindow()) return

  try {
    window.localStorage.setItem(OVERVIEW_COMPACT_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // Ignore storage failures; compact mode should still work in-memory.
  }
}
