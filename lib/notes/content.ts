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
