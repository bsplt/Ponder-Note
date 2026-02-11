import { useCallback, useEffect, useRef } from 'react'

/**
 * Manages JS-driven max-height for note rows so that the CSS transition
 * animates over the exact content height instead of a hardcoded large value.
 *
 * The problem: CSS `max-height` transitions to a fixed large value (e.g. 600px)
 * cause a dead delay on collapse because the animation starts from 600px but
 * nothing is visible until it crosses the actual content height (~250px).
 *
 * The fix: set `max-height` to the element's `scrollHeight` when focused,
 * so the transition distance matches real content exactly.
 */
export function useNoteRowHeight(focusedIndex: number) {
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map())

  const setRowRef = useCallback((index: number, el: HTMLLIElement | null) => {
    if (el) {
      rowRefs.current.set(index, el)
    } else {
      rowRefs.current.delete(index)
    }
  }, [])

  const scrollRowIntoView = useCallback((index: number) => {
    const el = rowRefs.current.get(index)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }, [])

  // Apply the correct max-height to all rows whenever focusedIndex changes
  useEffect(() => {
    for (const [index, el] of rowRefs.current) {
      if (index === focusedIndex) {
        // Temporarily remove max-height constraint to measure true content height
        el.style.maxHeight = 'none'
        const contentHeight = el.scrollHeight
        el.style.maxHeight = ''

        // Force a reflow so the browser sees the collapsed max-height,
        // then set the target max-height for the transition to animate toward.
        void el.offsetHeight
        el.style.maxHeight = `${contentHeight}px`
      } else {
        // Clear inline max-height so CSS default (var(--size-note-row)) applies
        el.style.maxHeight = ''
      }
    }
  }, [focusedIndex])

  // On resize, recalculate the focused row's max-height (content may reflow)
  useEffect(() => {
    let rafId: number | null = null

    const onResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const el = rowRefs.current.get(focusedIndex)
        if (!el) return

        // Disable transition during resize to avoid janky animation
        el.style.transition = 'none'
        el.style.maxHeight = 'none'
        const contentHeight = el.scrollHeight
        el.style.maxHeight = `${contentHeight}px`

        // Re-enable transition on next frame
        requestAnimationFrame(() => {
          el.style.transition = ''
        })
      })
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [focusedIndex])

  return { setRowRef, scrollRowIntoView }
}
