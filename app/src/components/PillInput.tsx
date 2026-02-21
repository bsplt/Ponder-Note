import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { TagAutocomplete } from './TagAutocomplete'

export type PillInputProps = {
  values: string[]
  onChange: (values: string[]) => void
  onBlur?: (values: string[]) => void
  suggestions?: string[]
  placeholder?: string
}

/**
 * Pill-based input for tag editing.
 *
 * Features:
 * - Display pills followed by text input: [work] [meeting] <input>
 * - Comma or Enter creates pill from input text (trimmed, non-empty)
 * - Silently deduplicate if tag already exists
 * - Backspace when input empty removes last pill
 * - Show autocomplete dropdown when typing (if suggestions provided)
 * - Call onBlur when input loses focus
 */
export function PillInput(props: PillInputProps) {
  const { values, onChange, onBlur, suggestions = [], placeholder = 'Add tags' } = props

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)

  const addPill = useCallback(
    (text: string): string[] => {
      const trimmed = text.trim()
      if (!trimmed) return values
      // Silently deduplicate
      if (values.includes(trimmed)) {
        setInputValue('')
        return values
      }
      const nextValues = [...values, trimmed]
      onChange(nextValues)
      setInputValue('')
      return nextValues
    },
    [onChange, values],
  )

  const removePill = useCallback(
    (index: number) => {
      onChange(values.filter((_, i) => i !== index))
    },
    [onChange, values],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Comma or Enter creates pill
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addPill(inputValue)
        setShowAutocomplete(false)
        return
      }

      // Backspace when input empty removes last pill
      if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
        e.preventDefault()
        onChange(values.slice(0, -1))
        return
      }

      // Escape closes autocomplete
      if (e.key === 'Escape') {
        setShowAutocomplete(false)
        return
      }

      // Tab accepts autocomplete selection (handled in TagAutocomplete)
      // Arrow keys navigate autocomplete (handled in TagAutocomplete)
    },
    [addPill, inputValue, onChange, values],
  )

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowAutocomplete(value.trim().length > 0)
  }, [])

  const handleBlur = useCallback(() => {
    // Create pill from any remaining input text on blur.
    const nextValues = addPill(inputValue)
    setShowAutocomplete(false)
    onBlur?.(nextValues)
  }, [addPill, inputValue, onBlur])

  const handleAutocompleteSelect = useCallback(
    (tag: string) => {
      if (tag) {
        addPill(tag)
      }
      setShowAutocomplete(false)
      inputRef.current?.focus()
    },
    [addPill],
  )

  const handleAutocompleteClose = useCallback(() => {
    setShowAutocomplete(false)
  }, [])

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  // Filter out already selected tags from suggestions
  const filteredSuggestions = suggestions.filter((s) => !values.includes(s))

  return (
    <div className="pillInput" onClick={handleContainerClick}>
      <div className="pillInputContent">
        {values.map((value, idx) => (
          <span key={idx} className="pill">
            {value}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removePill(idx)
              }}
              aria-label={`Remove ${value}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={values.length === 0 ? placeholder : ''}
          className="pillInputField"
        />
      </div>
      {showAutocomplete && filteredSuggestions.length > 0 && (
        <TagAutocomplete
          inputValue={inputValue}
          suggestions={filteredSuggestions}
          onSelect={handleAutocompleteSelect}
          onClose={handleAutocompleteClose}
          inputRef={inputRef}
        />
      )}
    </div>
  )
}
