import { confirm, open } from '@tauri-apps/plugin-dialog'

export async function pickDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false })
  return typeof selected === 'string' ? selected : null
}

export async function confirmReplace(message: string): Promise<boolean> {
  return await confirm(message)
}
