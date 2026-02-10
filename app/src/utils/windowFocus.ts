import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'

type FocusAnchor = HTMLElement | null | undefined

function focusAnchor(anchor: FocusAnchor): void {
  if (!anchor) return
  if (document.activeElement === anchor) return
  anchor.focus({ preventScroll: true })
}

export async function restoreAppInputFocus(anchor?: FocusAnchor): Promise<void> {
  try {
    await getCurrentWindow().setFocus()
  } catch (error) {
    console.debug('[ponder][focus] window focus restore failed', error)
  }

  try {
    await getCurrentWebview().setFocus()
  } catch (error) {
    console.debug('[ponder][focus] webview focus restore failed', error)
  }

  if (typeof window !== 'undefined') {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        focusAnchor(anchor)
        resolve()
      })
    })
  }
}
