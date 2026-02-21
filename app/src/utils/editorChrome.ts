import { getCurrentWindow } from '@tauri-apps/api/window'

const APP_BG_VAR = '--app-bg'
const DEFAULT_SLOT = 1
const DEFAULT_COLOR_FALLBACK = '#FFD35C'
let lastNativeWindowColorKey: string | null = null

type TauriColor = {
  red: number
  green: number
  blue: number
  alpha: number
}

export function noteSlotToCssVar(slot: number): string {
  return `--color-slot-${slot}`
}

export function readCssColorVar(varName: string): string | null {
  if (typeof document === 'undefined') return null
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value.length > 0 ? value : null
}

export function hexToTauriColor(hex: string): TauriColor | null {
  const value = hex.trim()
  const shortHex = /^#([0-9a-f]{3}|[0-9a-f]{4})$/i
  const longHex = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i
  if (!shortHex.test(value) && !longHex.test(value)) return null

  const normalized =
    value.length === 4 || value.length === 5
      ? `#${value
          .slice(1)
          .split('')
          .map((char) => char + char)
          .join('')}`
      : value

  const hasAlpha = normalized.length === 9
  const red = parseInt(normalized.slice(1, 3), 16)
  const green = parseInt(normalized.slice(3, 5), 16)
  const blue = parseInt(normalized.slice(5, 7), 16)
  const alpha = hasAlpha ? parseInt(normalized.slice(7, 9), 16) : 255
  return { red, green, blue, alpha }
}

function cssColorToTauriColor(color: string): TauriColor | null {
  const hex = hexToTauriColor(color)
  if (hex) return hex

  const rgb = color.trim().match(/^rgba?\((.+)\)$/i)
  if (!rgb) return null

  const channels = rgb[1].split(',').map((part) => part.trim())
  if (channels.length !== 3 && channels.length !== 4) return null

  const red = Number(channels[0])
  const green = Number(channels[1])
  const blue = Number(channels[2])
  const alpha = channels.length === 4 ? Number(channels[3]) : 1
  if (![red, green, blue, alpha].every(Number.isFinite)) return null

  return {
    red: Math.max(0, Math.min(255, Math.round(red))),
    green: Math.max(0, Math.min(255, Math.round(green))),
    blue: Math.max(0, Math.min(255, Math.round(blue))),
    alpha: Math.max(0, Math.min(255, Math.round(alpha * 255))),
  }
}

function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform ?? ''
  const userAgent = navigator.userAgent ?? ''
  return /mac/i.test(platform) || /macintosh|mac os x/i.test(userAgent)
}

async function setWindowBackgroundColor(color: string): Promise<void> {
  if (!isMacOS()) return
  const colorKey = color.trim().toLowerCase()
  if (lastNativeWindowColorKey === colorKey) return

  const tauriColor = cssColorToTauriColor(color)
  if (!tauriColor) return

  try {
    await getCurrentWindow().setBackgroundColor(tauriColor)
    lastNativeWindowColorKey = colorKey
  } catch (error) {
    console.warn('[ponder][editor_chrome] failed to set window background color', error)
  }
}

export async function applyEditorChrome(slot: number): Promise<void> {
  if (typeof document === 'undefined') return
  const color = readCssColorVar(noteSlotToCssVar(slot)) ?? DEFAULT_COLOR_FALLBACK
  document.documentElement.style.setProperty(APP_BG_VAR, color)
  await setWindowBackgroundColor(color)
}

export async function resetEditorChrome(): Promise<void> {
  if (typeof document === 'undefined') return
  document.documentElement.style.removeProperty(APP_BG_VAR)
  const defaultColor = readCssColorVar(noteSlotToCssVar(DEFAULT_SLOT)) ?? DEFAULT_COLOR_FALLBACK
  await setWindowBackgroundColor(defaultColor)
}
