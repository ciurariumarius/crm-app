export const DEFAULT_NOTE_TITLE = "New note"
export const DEFAULT_NOTE_PREVIEW = "No additional text"

const TITLE_MAX_LENGTH = 240

function toNormalizedLines(content: string): string[] {
  if (!content.trim()) return []

  const normalized = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|div|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")

  return normalized
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
}

export function deriveNoteTitleFromContent(content: string, fallback = DEFAULT_NOTE_TITLE) {
  const firstLine = toNormalizedLines(content)[0]
  if (!firstLine) return fallback
  return firstLine.slice(0, TITLE_MAX_LENGTH)
}

export function derivePreviewBodyFromContent(content: string, fallback = DEFAULT_NOTE_PREVIEW) {
  const lines = toNormalizedLines(content)
  if (lines.length <= 1) return fallback

  const body = lines.slice(1).join(" ").trim()
  if (!body) return fallback
  return body
}
