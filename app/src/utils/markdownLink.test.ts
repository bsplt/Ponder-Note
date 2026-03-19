import { describe, expect, it } from 'vitest'
import { shouldOpenMarkdownLinkExternally } from './markdownLink'

describe('shouldOpenMarkdownLinkExternally', () => {
  it('opens https links externally', () => {
    expect(shouldOpenMarkdownLinkExternally('https://example.com')).toBe(true)
  })

  it('opens http links externally', () => {
    expect(shouldOpenMarkdownLinkExternally('http://example.com')).toBe(true)
  })

  it('opens mailto links externally', () => {
    expect(shouldOpenMarkdownLinkExternally('mailto:hello@example.com')).toBe(true)
  })

  it('opens tel links externally', () => {
    expect(shouldOpenMarkdownLinkExternally('tel:+49123456789')).toBe(true)
  })

  it('keeps fragment links inside the preview', () => {
    expect(shouldOpenMarkdownLinkExternally('#fn1')).toBe(false)
  })

  it('keeps relative links inside the app', () => {
    expect(shouldOpenMarkdownLinkExternally('docs/page.md')).toBe(false)
  })

  it('returns false for empty or invalid href values', () => {
    expect(shouldOpenMarkdownLinkExternally('')).toBe(false)
    expect(shouldOpenMarkdownLinkExternally('   ')).toBe(false)
    expect(shouldOpenMarkdownLinkExternally('https://')).toBe(false)
    expect(shouldOpenMarkdownLinkExternally(undefined)).toBe(false)
  })
})
