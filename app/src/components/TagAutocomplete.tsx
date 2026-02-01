import { useCallback, useEffect, useState, type RefObject } from 'react'

export type TagAutocompleteProps = {
  inputValue: string
  suggestions: string[]
  onSelect: (value: string) => void
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

/**
 * Autocomplete dropdown for tag suggestions.
 *
 * Features:
 * - Filter suggestions by inputValue (case-insensitive contains match)
 * - Show max 10 suggestions
 * - Arrow up/down navigate, Tab/Enter select, Escape closes
 * - Click suggestion to select
 * - Position below input (absolute positioning)
 */
export function TagAutocomplete(props: TagAutocompleteProps) {
  const { inputValue, suggestions, onSelect, onClose, inputRef } = props

  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter suggestions by inputValue (case-insensitive contains)
  const filtered = suggestions
    .filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 10)

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [inputValue])

  const handleSelect = useCallback(
    (tag: string) => {
      onSelect(tag)
    },
    [onSelect],
  )

  // Keyboard navigation handled via event listener on the input
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Tab' || e.key === 'Enter') {
        if (filtered[selectedIndex]) {
          e.preventDefault()
          handleSelect(filtered[selectedIndex])
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
    }

    input.addEventListener('keydown', handleKeyDown)
    return () => input.removeEventListener('keydown', handleKeyDown)
  }, [filtered, handleSelect, inputRef, onClose, selectedIndex])

  if (!filtered.length) return null

  return (
    <div className="autocompleteDropdown">
      {filtered.map((tag, idx) => (
        <div
          key={tag}
          className={`autocompleteItem${idx === selectedIndex ? ' autocompleteItemSelected' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            handleSelect(tag)
          }}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          {tag}
        </div>
      ))}
    </div>
  )
}
