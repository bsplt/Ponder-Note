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
export function useNoteRowHeight(focusedIndex: number, layoutMode: 'normal' | 'compact') {
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const immediateScrollRafRef = useRef<number | null>(null)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationRafRef = useRef<number | null>(null)

  const setRowRef = useCallback((index: number, el: HTMLLIElement | null) => {
    if (el) {
      rowRefs.current.set(index, el)
    } else {
      rowRefs.current.delete(index)
    }
  }, [])

  const clearPendingScrollWork = useCallback(() => {
    if (immediateScrollRafRef.current !== null) {
      cancelAnimationFrame(immediateScrollRafRef.current)
      immediateScrollRafRef.current = null
    }
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    if (animationRafRef.current !== null) {
      cancelAnimationFrame(animationRafRef.current)
      animationRafRef.current = null
    }
  }, [])

  const viewportMetrics = useCallback(() => {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const maxDocumentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight ?? 0,
    )
    const maxScrollTop = Math.max(0, maxDocumentHeight - viewportHeight)
    const currentScrollTop =
      window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
    return { viewportHeight, maxScrollTop, currentScrollTop }
  }, [])

  const targetScrollTopForNearestVisibility = useCallback((el: HTMLLIElement): number | null => {
    const { viewportHeight, maxScrollTop, currentScrollTop } = viewportMetrics()
    const rect = el.getBoundingClientRect()
    const rowTop = currentScrollTop + rect.top
    const rowBottom = currentScrollTop + rect.bottom
    const viewportTop = currentScrollTop
    const viewportBottom = currentScrollTop + viewportHeight

    if (rowTop < viewportTop) {
      return Math.min(maxScrollTop, Math.max(0, rowTop))
    }

    if (rowBottom > viewportBottom) {
      return Math.min(maxScrollTop, Math.max(0, rowBottom - viewportHeight))
    }

    return null
  }, [viewportMetrics])

  const animateWindowScrollTo = useCallback((targetScrollTop: number, durationMs: number) => {
    if (animationRafRef.current !== null) {
      cancelAnimationFrame(animationRafRef.current)
      animationRafRef.current = null
    }

    const { maxScrollTop, currentScrollTop } = viewportMetrics()
    const clampedTarget = Math.min(maxScrollTop, Math.max(0, targetScrollTop))
    const distance = clampedTarget - currentScrollTop

    if (Math.abs(distance) < 1 || durationMs <= 0) {
      window.scrollTo({ top: clampedTarget, behavior: 'auto' })
      return
    }

    const startTime = performance.now()
    const startScrollTop = currentScrollTop

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      window.scrollTo({ top: startScrollTop + distance * eased, behavior: 'auto' })

      if (t < 1) {
        animationRafRef.current = requestAnimationFrame(step)
      } else {
        animationRafRef.current = null
      }
    }

    animationRafRef.current = requestAnimationFrame(step)
  }, [viewportMetrics])

  const scrollFocusedRowIfNeeded = useCallback((index: number, durationMs: number) => {
    const el = rowRefs.current.get(index)
    if (!el) return

    const targetScrollTop = targetScrollTopForNearestVisibility(el)
    if (targetScrollTop === null) return

    animateWindowScrollTo(targetScrollTop, durationMs)
  }, [animateWindowScrollTo, targetScrollTopForNearestVisibility])

  const scrollRowIntoView = useCallback(
    (index: number, options?: { durationMs?: number; settleDelayMs?: number }) => {
      const durationMs = options?.durationMs ?? 100
      const settleDelayMs = options?.settleDelayMs ?? 110

      clearPendingScrollWork()

      immediateScrollRafRef.current = requestAnimationFrame(() => {
        immediateScrollRafRef.current = null
        scrollFocusedRowIfNeeded(index, durationMs)
      })

      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null
        scrollFocusedRowIfNeeded(index, durationMs)
      }, settleDelayMs)
    },
    [clearPendingScrollWork, scrollFocusedRowIfNeeded],
  )

  // Apply the correct max-height to all rows whenever focus or layout density changes
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
  }, [focusedIndex, layoutMode])

  useEffect(() => {
    return () => {
      clearPendingScrollWork()
    }
  }, [clearPendingScrollWork])

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
  }, [focusedIndex, layoutMode])

  return { setRowRef, scrollRowIntoView }
}
