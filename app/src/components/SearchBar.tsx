import { useCallback, type KeyboardEvent, type ChangeEvent } from 'react'

export type SearchBarProps = {
  searchText: string
  onSearchTextChange: (text: string) => void
  includeTags: string[]
  onIncludeTagsChange: (tags: string[]) => void
  excludeTags: string[]
  onExcludeTagsChange: (tags: string[]) => void
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}

/**
 * SearchBar component with tag filter pills and text input.
 *
 * Features:
 * - Displays include/exclude tag filter pills before the text input
 * - Include tags shown as light pills, exclude tags with "-" prefix
 * - Pills can be removed via X button or backspace when input is empty
 * - Typing #tagname creates include tag pill
 * - Typing #-tagname creates exclude tag pill
 * - Real-time filtering (no debounce)
 */
export function SearchBar(props: SearchBarProps) {
  const {
    searchText,
    onSearchTextChange,
    includeTags,
    onIncludeTagsChange,
    excludeTags,
    onExcludeTagsChange,
    placeholder = 'Search notes...',
    inputRef,
  } = props

  const removeIncludeTag = useCallback(
    (tag: string) => {
      onIncludeTagsChange(includeTags.filter((t) => t !== tag))
    },
    [includeTags, onIncludeTagsChange],
  )

  const removeExcludeTag = useCallback(
    (tag: string) => {
      onExcludeTagsChange(excludeTags.filter((t) => t !== tag))
    },
    [excludeTags, onExcludeTagsChange],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Escape: clear everything and blur
      if (e.key === 'Escape') {
        e.preventDefault()
        onSearchTextChange('')
        onIncludeTagsChange([])
        onExcludeTagsChange([])
        e.currentTarget.blur()
        return
      }

      // Backspace when input is empty: remove last pill
      if (e.key === 'Backspace' && searchText === '') {
        e.preventDefault()
        // Remove last include tag first, then exclude tag
        if (includeTags.length > 0) {
          onIncludeTagsChange(includeTags.slice(0, -1))
        } else if (excludeTags.length > 0) {
          onExcludeTagsChange(excludeTags.slice(0, -1))
        }
        return
      }

      // Enter: check for #tag or #-tag patterns
      if (e.key === 'Enter') {
        const trimmed = searchText.trim()

        // Check for exclude tag pattern: #-tagname
        if (trimmed.startsWith('#-') && trimmed.length > 2) {
          e.preventDefault()
          const tag = trimmed.slice(2).trim()
          if (tag && !excludeTags.includes(tag)) {
            onExcludeTagsChange([...excludeTags, tag])
          }
          onSearchTextChange('')
          return
        }

        // Check for include tag pattern: #tagname
        if (trimmed.startsWith('#') && trimmed.length > 1) {
          e.preventDefault()
          const tag = trimmed.slice(1).trim()
          if (tag && !includeTags.includes(tag)) {
            onIncludeTagsChange([...includeTags, tag])
          }
          onSearchTextChange('')
          return
        }

        // Otherwise, Enter does nothing (search is real-time)
        return
      }

      // Space after #tag or #-tag: create pill
      if (e.key === ' ') {
        const trimmed = searchText.trim()

        // Check for exclude tag pattern: #-tagname
        if (trimmed.startsWith('#-') && trimmed.length > 2) {
          e.preventDefault()
          const tag = trimmed.slice(2).trim()
          if (tag && !excludeTags.includes(tag)) {
            onExcludeTagsChange([...excludeTags, tag])
          }
          onSearchTextChange('')
          return
        }

        // Check for include tag pattern: #tagname
        if (trimmed.startsWith('#') && trimmed.length > 1) {
          e.preventDefault()
          const tag = trimmed.slice(1).trim()
          if (tag && !includeTags.includes(tag)) {
            onIncludeTagsChange([...includeTags, tag])
          }
          onSearchTextChange('')
          return
        }
      }
    },
    [
      searchText,
      includeTags,
      excludeTags,
      onSearchTextChange,
      onIncludeTagsChange,
      onExcludeTagsChange,
    ],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      // Synchronous update to preserve cursor position
      onSearchTextChange(e.target.value)
    },
    [onSearchTextChange],
  )

  const hasPills = includeTags.length > 0 || excludeTags.length > 0

  return (
    <div className="searchBar">
      {includeTags.map((tag) => (
        <span key={`include-${tag}`} className="filterPill filterPillInclude">
          {tag}
          <button
            type="button"
            onClick={() => removeIncludeTag(tag)}
            aria-label={`Remove ${tag} filter`}
          >
            ×
          </button>
        </span>
      ))}
      {excludeTags.map((tag) => (
        <span key={`exclude-${tag}`} className="filterPill filterPillExclude">
          -{tag}
          <button
            type="button"
            onClick={() => removeExcludeTag(tag)}
            aria-label={`Remove ${tag} exclusion filter`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={searchText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={hasPills ? '' : placeholder}
        className="searchBarInput"
      />
    </div>
  )
}
