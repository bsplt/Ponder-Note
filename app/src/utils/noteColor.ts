/**
 * Returns a deterministic color slot (1–8) for a given note stem.
 * Used to assign each note a persistent background color from
 * the --color-slot-1 … --color-slot-8 CSS custom properties.
 */
export function noteColorSlot(stem: string): number {
  let hash = 0
  for (let i = 0; i < stem.length; i++) {
    hash = ((hash << 5) - hash + stem.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 8) + 1
}
