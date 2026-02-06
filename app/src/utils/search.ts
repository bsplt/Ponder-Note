import type { NoteSummary } from '../api/workspace'

/**
 * Escapes regex special characters in a string, EXCEPT for `*` which is used
 * as a wildcard. The `*` characters are handled separately in buildSearchRegex.
 */
function escapeRegExpPart(str: string): string {
  // Escape all regex special characters
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Escapes regex special characters, treating `*` as a wildcard that matches
 * any sequence of characters.
 *
 * @example
 * escapeRegExp("meet*ing") // returns "meet.*ing"
 * escapeRegExp("project.name") // returns "project\\.name"
 */
export function escapeRegExp(str: string): string {
  // Split on `*`, escape each part, then join with `.*`
  return str.split('*').map(escapeRegExpPart).join('.*')
}

/**
 * Builds a case-insensitive regex for searching with AND logic across
 * multiple terms. Each term supports `*` as a wildcard.
 *
 * @param query - The search query (space-separated terms)
 * @returns A RegExp that matches if ALL terms are present, or null if query is empty
 *
 * @example
 * buildSearchRegex("project meeting") // matches notes with both "project" AND "meeting"
 * buildSearchRegex("meet*") // matches "meeting", "meetup", etc.
 * buildSearchRegex("") // returns null
 */
export function buildSearchRegex(query: string): RegExp | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  // Split query on whitespace into individual terms
  const terms = trimmed.split(/\s+/)

  // Build lookahead pattern for AND logic: (?=.*term1)(?=.*term2)...
  // Each term gets escaped (with * converted to .*)
  const patterns = terms.map((term) => {
    const escaped = escapeRegExp(term)
    return `(?=.*${escaped})`
  })

  return new RegExp(patterns.join(''), 'i')
}

/**
 * Filters notes by tag inclusion/exclusion and search text.
 *
 * Filtering logic:
 * 1. Include tags (AND logic): note must have ALL included tags
 * 2. Exclude tags: note must have NONE of the excluded tags
 * 3. Search text: matches against note title and body content
 *
 * @param notes - Array of notes to filter
 * @param searchText - Text to search for in note titles and body (supports wildcards)
 * @param includeTags - Tags that must ALL be present on the note
 * @param excludeTags - Tags that must NOT be present on the note
 * @returns Filtered notes in original order (chronological by timestamp)
 */
export function filterNotes(
  notes: NoteSummary[],
  searchText: string,
  includeTags: string[],
  excludeTags: string[]
): NoteSummary[] {
  let filtered = notes

  // Filter by include tags (AND logic: must have ALL)
  if (includeTags.length > 0) {
    filtered = filtered.filter((note) =>
      includeTags.every((tag) => note.tags?.includes(tag))
    )
  }

  // Filter by exclude tags (must have NONE)
  if (excludeTags.length > 0) {
    filtered = filtered.filter(
      (note) => !excludeTags.some((tag) => note.tags?.includes(tag))
    )
  }

  // Filter by search text (title + body content)
  const regex = buildSearchRegex(searchText)
  if (regex) {
    filtered = filtered.filter((note) => {
      const searchableText = [note.title ?? '', note.preview ?? ''].join(' ')
      return regex.test(searchableText)
    })
  }

  return filtered
}
