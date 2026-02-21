# Phase 4: Search & Tags - Research

**Researched:** 2026-02-01
**Domain:** React UI components (pill inputs, autocomplete), full-text filtering
**Confidence:** HIGH

## Summary

Phase 4 implements tag management and full-text search filtering for notes. The research covers building custom pill-based inputs, autocomplete dropdowns, real-time filtering with wildcards, and keyboard navigation patterns in React.

The standard approach for this phase is **custom React components** built on controlled inputs using native DOM APIs. No third-party UI libraries are needed—the existing project uses vanilla React + TypeScript, and all required functionality can be implemented with React state management, keyboard event handling, and string matching utilities.

Key findings:
- Pill inputs are controlled components managing an array of tag strings
- Autocomplete uses position-anchored dropdowns with keyboard navigation
- Full-text search uses RegExp for wildcard support and case-insensitive matching
- All keyboard interactions (arrow keys, backspace, Cmd+F) use KeyboardEvent handlers

**Primary recommendation:** Build custom pill input and autocomplete components using React controlled inputs, manage filtering state locally in Overview component, and use native RegExp for search with wildcard support.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | UI framework | Already in project, sufficient for all UI needs |
| TypeScript | 5.8.3 | Type safety | Already in project, provides type safety for component state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | N/A | No additional libraries needed | Pure React implementation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom pill input | react-tag-input, react-select | Third-party libs add bundle size and lock-in; custom implementation is ~100 LOC and fully controlled |
| Custom autocomplete | downshift, react-autocomplete | Adds complexity for simple dropdown; native implementation is straightforward with useRef + position calculation |
| RegExp search | fuse.js, flexsearch | Fuzzy search libs are overkill for simple wildcard matching; RegExp is zero-dependency and performant for <10k notes |

**Installation:**
No additional packages needed—use existing React + TypeScript setup.

## Architecture Patterns

### Recommended Component Structure
```
src/
├── components/
│   ├── PillInput.tsx         # Reusable pill-based input for tags
│   ├── TagAutocomplete.tsx   # Autocomplete dropdown for tag suggestions
│   └── SearchBar.tsx         # Unified search bar with filter pills + text input
├── screens/
│   ├── Overview.tsx          # Add search/filter state and note filtering logic
│   └── Editor.tsx            # Add tag editing with PillInput
└── utils/
    └── search.ts             # Search/filter utilities (wildcard matching, tag filtering)
```

### Pattern 1: Pill Input Component
**What:** Controlled input managing an array of string values displayed as removable pills
**When to use:** Tag editing in editor, tag filter pills in search bar
**Example:**
```typescript
// Pill input pattern (controlled array of strings)
type PillInputProps = {
  values: string[]
  onChange: (values: string[]) => void
  suggestions?: string[]
  placeholder?: string
}

function PillInput({ values, onChange, suggestions, placeholder }: PillInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [focusedPillIndex, setFocusedPillIndex] = useState<number | null>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (trimmed && !values.includes(trimmed)) {
        onChange([...values, trimmed])
        setInputValue('')
      }
    } else if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
      onChange(values.slice(0, -1)) // Remove last pill
    } else if (e.key === 'ArrowLeft' && inputValue === '') {
      // Navigate to last pill
      setFocusedPillIndex(values.length - 1)
    }
  }

  const removePill = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div className="pillInput">
      {values.map((value, index) => (
        <span key={index} className="pill">
          {value}
          <button onClick={() => removePill(index)}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={values.length === 0 ? placeholder : '+'}
      />
    </div>
  )
}
```

### Pattern 2: Autocomplete Dropdown
**What:** Position-anchored dropdown showing filtered suggestions, navigable with keyboard
**When to use:** Tag suggestions in editor, tag name autocomplete in search bar
**Example:**
```typescript
// Autocomplete dropdown pattern
type AutocompleteProps = {
  inputValue: string
  suggestions: string[]
  onSelect: (value: string) => void
  anchorRef: RefObject<HTMLElement>
}

function Autocomplete({ inputValue, suggestions, onSelect, anchorRef }: AutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = suggestions.filter(s => 
    s.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 10) // Limit to 10 suggestions

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        onSelect('') // Close dropdown
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedIndex, onSelect])

  if (!filtered.length) return null

  return (
    <div ref={dropdownRef} className="autocompleteDropdown">
      {filtered.map((item, index) => (
        <div
          key={item}
          className={index === selectedIndex ? 'selected' : ''}
          onClick={() => onSelect(item)}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
```

### Pattern 3: Real-time Filtering with Wildcards
**What:** Filter notes array based on search text (with wildcards) and tag filters
**When to use:** Overview screen note list filtering
**Example:**
```typescript
// Search/filter utilities
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSearchRegex(query: string): RegExp | null {
  if (!query.trim()) return null
  
  // Split on spaces for AND logic
  const terms = query.trim().split(/\s+/)
  
  // Convert wildcards (* → .*) and escape other special chars
  const patterns = terms.map(term => {
    const escaped = term.split('*').map(escapeRegExp).join('.*')
    return `(?=.*${escaped})`
  })
  
  return new RegExp(patterns.join(''), 'i') // case-insensitive
}

function filterNotes(
  notes: NoteSummary[],
  searchText: string,
  includeTags: string[],
  excludeTags: string[]
): NoteSummary[] {
  let filtered = notes

  // Filter by tags first (AND logic for included, exclude any excluded)
  if (includeTags.length > 0) {
    filtered = filtered.filter(note =>
      includeTags.every(tag => note.tags?.includes(tag))
    )
  }
  if (excludeTags.length > 0) {
    filtered = filtered.filter(note =>
      !excludeTags.some(tag => note.tags?.includes(tag))
    )
  }

  // Filter by search text (title + body)
  const regex = buildSearchRegex(searchText)
  if (regex) {
    filtered = filtered.filter(note => {
      const searchableText = `${note.title || ''} ${note.body || ''}`
      return regex.test(searchableText)
    })
  }

  return filtered
}
```

### Pattern 4: Keyboard Shortcut Registration
**What:** Global keyboard listener for Cmd+F to focus search input
**When to use:** Overview screen for search shortcut
**Example:**
```typescript
// Keyboard shortcut pattern (from existing Overview.tsx pattern)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      searchInputRef.current?.focus()
    }
  }
  
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

### Anti-Patterns to Avoid
- **Debouncing real-time search**: Context specifies "real-time (as you type), no debounce"—filter on every keystroke
- **Complex fuzzy search libraries**: Requirements only need basic wildcard support (`*`), not fuzzy matching
- **Uncontrolled pill inputs**: Pills must be controlled components to support backspace removal and arrow key navigation
- **Inline pill editing without state**: Clicking a pill to edit requires toggling between pill display and input edit mode with focused state management

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown positioning | Manual getBoundingClientRect calculations | CSS `position: absolute` with parent `position: relative` | Positioning pills/dropdowns is simple CSS—no need for complex JS calculations |
| Tag deduplication | Custom Set logic scattered in handlers | `Array.includes()` check before adding | Native array methods handle deduplication cleanly |
| Keyboard event normalization | Custom key code mapping | `KeyboardEvent.key` property (modern standard) | `key` property is well-supported and returns human-readable strings like "Enter", "," |

**Key insight:** This domain benefits from simple, native solutions. React state + DOM APIs handle all requirements without libraries. Focus effort on component composition and state management, not reinventing platform features.

## Common Pitfalls

### Pitfall 1: Controlled Input Cursor Jumping
**What goes wrong:** When updating controlled input value asynchronously or to a different value than `e.target.value`, cursor jumps to end
**Why it happens:** React re-renders input with new value, losing cursor position
**How to avoid:** Always update state synchronously with exact `e.target.value` in onChange handler
**Warning signs:** Cursor jumps to end when typing in middle of text
**Example:**
```typescript
// ❌ BAD: Transforms value asynchronously
const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
  setTimeout(() => setInputValue(e.target.value), 0) // Cursor jumps!
}

// ✅ GOOD: Synchronous update with exact value
const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
  setInputValue(e.target.value) // Cursor stays in place
}
```

### Pitfall 2: Autocomplete Dropdown Not Closing
**What goes wrong:** Autocomplete dropdown remains visible after selection or Escape
**Why it happens:** Dropdown visibility tied to input focus, not selection state
**How to avoid:** Track dropdown open state separately, close on selection/Escape/blur
**Warning signs:** Dropdown stays open after clicking suggestion or pressing Escape
**Example:**
```typescript
// ✅ GOOD: Explicit dropdown state
const [showDropdown, setShowDropdown] = useState(false)

const handleSelect = (value: string) => {
  onChange([...values, value])
  setInputValue('')
  setShowDropdown(false) // Explicitly close
}

// Close on blur
const handleBlur = () => {
  setTimeout(() => setShowDropdown(false), 200) // Delay to allow click
}
```

### Pitfall 3: Wildcard Regex Injection
**What goes wrong:** User search `".*"` or `"[a-z]+"` breaks search or matches everything
**Why it happens:** Building regex directly from user input without escaping
**How to avoid:** Escape all regex special chars except `*`, then replace `*` with `.*`
**Warning signs:** Search breaks with special characters, or matches unexpectedly
**Example:**
```typescript
// ❌ BAD: Direct regex construction
new RegExp(userInput, 'i') // User input ".* " matches everything!

// ✅ GOOD: Escape special chars, allow only *
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const escaped = userInput.split('*').map(escapeRegExp).join('.*')
new RegExp(escaped, 'i')
```

### Pitfall 4: Tag Click Conflicts with Row Click
**What goes wrong:** Clicking tag in overview row triggers both tag filter AND row selection
**Why it happens:** Event bubbling—tag click bubbles up to parent row click handler
**How to avoid:** Call `e.stopPropagation()` in tag click handler
**Warning signs:** Clicking tag triggers multiple actions (filter + focus row)
**Example:**
```typescript
// ✅ GOOD: Stop propagation on tag click
<span 
  className="tag" 
  onClick={(e) => {
    e.stopPropagation() // Don't trigger row click
    handleTagClick(tag)
  }}
>
  {tag}
</span>
```

### Pitfall 5: Search State Lost on Navigation
**What goes wrong:** Search text and tag filters reset when opening a note and returning
**Why it happens:** Search state lives in Overview component, gets unmounted when navigating to Editor
**How to avoid:** Lift search/filter state to App component OR persist in URL params
**Warning signs:** Search input clears when returning to overview from editor
**Example:**
```typescript
// ✅ GOOD: Lift search state to App (or use URL params)
function App() {
  const [searchText, setSearchText] = useState('')
  const [tagFilters, setTagFilters] = useState<string[]>([])
  
  return screen === 'overview' ? (
    <Overview 
      searchText={searchText}
      tagFilters={tagFilters}
      onSearchChange={setSearchText}
      onTagFiltersChange={setTagFilters}
    />
  ) : <Editor />
}
```

## Code Examples

Verified patterns from official sources:

### Controlled Input with onChange
```typescript
// Source: https://react.dev/reference/react-dom/components/input
// Controlled input must update state synchronously with e.target.value
function TagInput() {
  const [value, setValue] = useState('')
  
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)} // Synchronous update
    />
  )
}
```

### Keyboard Event Handling
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
// Use event.key for human-readable key names
function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') {
    // Handle Enter key
  } else if (event.key === 'Backspace') {
    // Handle Backspace
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    // Handle arrow keys
  }
  // Avoid deprecated event.keyCode
}
```

### RegExp String Matching
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match
// Case-insensitive matching with 'i' flag
const searchTerm = 'meeting'
const regex = new RegExp(searchTerm, 'i')
const matches = noteText.match(regex) // Returns array or null

// Multi-word AND logic using lookahead assertions
const terms = ['project', 'meeting']
const pattern = terms.map(t => `(?=.*${escapeRegExp(t)})`).join('')
const andRegex = new RegExp(pattern, 'i')
const hasAllTerms = andRegex.test(noteText) // true if all terms present
```

### Array Filtering
```typescript
// Native array methods for tag filtering
const notes: NoteSummary[] = [
  { stem: '1', title: 'Note 1', tags: ['work', 'urgent'] },
  { stem: '2', title: 'Note 2', tags: ['personal'] },
]

// Include tags (AND logic)
const includeTags = ['work', 'urgent']
const withAllTags = notes.filter(note =>
  includeTags.every(tag => note.tags?.includes(tag))
)

// Exclude tags (exclude any)
const excludeTags = ['archived']
const withoutTags = notes.filter(note =>
  !excludeTags.some(tag => note.tags?.includes(tag))
)
```

### Focus Management with useRef
```typescript
// Focus input programmatically (e.g., Cmd+F shortcut)
const inputRef = useRef<HTMLInputElement>(null)

useEffect(() => {
  const handleShortcut = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }
  window.addEventListener('keydown', handleShortcut)
  return () => window.removeEventListener('keydown', handleShortcut)
}, [])

return <input ref={inputRef} type="text" />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `event.keyCode` | `event.key` | 2017 (baseline widely available) | Use human-readable `key` property instead of numeric codes |
| Uncontrolled inputs with refs | Controlled inputs with state | React best practices | Easier state management, better React integration |
| Manual dropdown positioning | CSS-based relative positioning | N/A | Simpler, more maintainable than getBoundingClientRect |
| Third-party tag input libs | Custom controlled components | N/A | Less bundle size, full control over behavior |

**Deprecated/outdated:**
- `event.keyCode`: Use `event.key` instead (returns "Enter", "Backspace", etc.)
- `event.which`: Use `event.key` instead
- Debouncing search input: Modern browsers handle real-time filtering efficiently for small datasets (<10k items)

## Open Questions

None—all technical requirements are well-understood and have clear implementation paths.

## Sources

### Primary (HIGH confidence)
- React official docs: https://react.dev/reference/react-dom/components/input (controlled inputs)
- MDN KeyboardEvent.key: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key (keyboard handling)
- MDN String.match: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match (regex search)

### Secondary (MEDIUM confidence)
- Existing codebase patterns (Overview.tsx keyboard handling, Editor.tsx controlled textarea)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React + TypeScript already in use, sufficient for all requirements
- Architecture: HIGH - Patterns verified from official React docs and existing codebase
- Pitfalls: HIGH - Common React controlled input pitfalls well-documented; regex injection is standard security concern

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, no fast-moving dependencies)
