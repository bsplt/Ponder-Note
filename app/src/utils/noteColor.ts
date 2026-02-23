/**
 * Returns a deterministic color slot (2–17) for a given note stem.
 * Used to assign each note a persistent background color from
 * the --color-slot-2 … --color-slot-17 CSS custom properties.
 * Slot 1 is reserved for the app background.
 */
export function noteColorSlot(stem: string): number {
  let hash = 0
  for (let i = 0; i < stem.length; i++) {
    hash = ((hash << 5) - hash + stem.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 16) + 2
}
