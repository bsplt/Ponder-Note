export type AppScreen = 'overview' | 'workspaces' | 'editor' | 'todolist' | 'shortcuts'

export type GlobalNavAction = 'overview' | 'workspaces' | 'todolist' | 'shortcuts' | 'new-note'

type KeyboardLikeTarget = {
  isContentEditable?: boolean
  tagName?: string
  closest?: (selector: string) => unknown
} | null

export type GlobalShortcutInput = {
  screen: AppScreen
  key: string
  repeat: boolean
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  target: EventTarget | null
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as KeyboardLikeTarget
  if (!el) return false

  if (el.isContentEditable) return true

  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true

  if (typeof el.closest === 'function') {
    return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'))
  }

  return false
}

export function getGlobalNavAction(input: GlobalShortcutInput): GlobalNavAction | null {
  if (input.repeat) return null
  if (input.metaKey || input.ctrlKey || input.altKey) return null
  if (input.screen === 'editor') return null
  if (isTypingTarget(input.target)) return null

  const key = input.key.toLowerCase()
  if (key === 'w') return 'workspaces'
  if (key === 'o') return 'overview'
  if (key === 't') return 'todolist'
  if (key === 'h' || key === '?') return 'shortcuts'
  if (key === 'n') return 'new-note'
  return null
}
