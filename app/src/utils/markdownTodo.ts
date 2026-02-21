export type MarkdownTodo = {
  text: string
  checked: boolean
  lineNumber: number
  charOffset: number
}

const CHECKBOX_REGEX = /^(\s*)(?:[-*+]\s+)?(\[(?: |x|X)\])\s+(.+)$/

function isFenceToggle(content: string): boolean {
  return content.startsWith('```') || content.startsWith('~~~')
}

function isBlockquote(content: string): boolean {
  return content.startsWith('>')
}

export function normalizePreviewTodoLines(body: string): string {
  const lines = body.split('\n')
  let inFence = false

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber]
    const trimmed = line.trimStart()

    if (isFenceToggle(trimmed)) {
      inFence = !inFence
      continue
    }

    if (inFence || isBlockquote(trimmed)) {
      continue
    }

    if (!/^\[(?: |x|X)\]\s+/.test(trimmed)) {
      continue
    }

    const indentation = line.slice(0, line.length - trimmed.length)
    lines[lineNumber] = `${indentation}- ${trimmed}`
  }

  return lines.join('\n')
}

export function extractMarkdownTodos(body: string): Map<number, MarkdownTodo> {
  const todosByLine = new Map<number, MarkdownTodo>()
  const lines = body.split('\n')
  let inFence = false

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber]
    const trimmed = line.trimStart()

    if (isFenceToggle(trimmed)) {
      inFence = !inFence
      continue
    }

    if (inFence || isBlockquote(trimmed)) {
      continue
    }

    const match = CHECKBOX_REGEX.exec(line)
    if (!match) continue

    const indentation = match[1] ?? ''
    const checkbox = match[2] ?? '[ ]'
    const text = match[3] ?? ''
    const markerMatch = /^[-*+]\s+/.exec(line.slice(indentation.length))
    const markerLength = markerMatch ? markerMatch[0].length : 0
    const charOffset = indentation.length + markerLength

    todosByLine.set(lineNumber, {
      text,
      checked: checkbox !== '[ ]',
      lineNumber,
      charOffset,
    })
  }

  return todosByLine
}

export function toggleMarkdownTodoInBody(
  body: string,
  lineNumber: number,
  charOffset: number,
): { body: string, checked: boolean } {
  const lines = body.split('\n')
  if (lineNumber < 0 || lineNumber >= lines.length) {
    throw new Error('Checkbox not found at specified location')
  }

  const line = lines[lineNumber]
  if (charOffset < 0 || charOffset + 3 > line.length) {
    throw new Error('Checkbox not found at specified location')
  }

  const checkbox = line.slice(charOffset, charOffset + 3)
  let newCheckbox: string
  if (checkbox === '[ ]') {
    newCheckbox = '[x]'
  } else if (checkbox === '[x]' || checkbox === '[X]') {
    newCheckbox = '[ ]'
  } else {
    throw new Error('Checkbox not found at specified location')
  }

  lines[lineNumber] = `${line.slice(0, charOffset)}${newCheckbox}${line.slice(charOffset + 3)}`

  return {
    body: lines.join('\n'),
    checked: newCheckbox === '[x]',
  }
}
