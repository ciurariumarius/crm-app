export function hasMeaningfulRichTextContent(value: string | null | undefined) {
  if (!value) return false

  if (/<(?:img|video|audio|canvas|svg|table|hr)\b|data-note-drawing-id=/i.test(value)) {
    return true
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, "")
    .length > 0
}

export function normalizeRichTextContent(value: string | null | undefined) {
  return hasMeaningfulRichTextContent(value) ? value || "" : ""
}

export function hasNoteContentStateChanged(input: {
  savedContent: string
  nextContent: string
  savedFolderId: string | null
  nextFolderId: string | null
}) {
  return input.savedContent !== input.nextContent
    || input.savedFolderId !== input.nextFolderId
}

export function normalizeRichTextLink(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? candidate : null
  } catch {
    return null
  }
}
