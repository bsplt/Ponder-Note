const EXTERNAL_MARKDOWN_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function shouldOpenMarkdownLinkExternally(href: string | null | undefined): boolean {
  const value = href?.trim()
  if (!value || value.startsWith('#')) return false

  try {
    const url = new URL(value)
    return EXTERNAL_MARKDOWN_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}
