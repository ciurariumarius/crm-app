export const NOTE_RETENTION_DAYS = 30
export const NOTE_UPDATED_WITHIN_OPTIONS = [1, 7, 30, 90] as const

export type NoteSmartFolderMatchMode = "all" | "any"

export type NoteSmartFolderCriteria = {
  tagIds: string[]
  matchMode: NoteSmartFolderMatchMode
  requirePinned: boolean | null
  requireChecklist: boolean | null
  requireAttachment: boolean | null
  updatedWithinDays: (typeof NOTE_UPDATED_WITHIN_OPTIONS)[number] | null
}

export type SmartFolderComparableNote = {
  pinned: boolean
  hasChecklist: boolean
  hasAttachment: boolean
  updatedAt: string | Date
  tagIds: string[]
}

const TAG_PATTERN = /(?:^|[\s>])#([\p{L}\p{N}_-]{1,48})/gu

export function normalizeNoteTagName(value: string) {
  return value
    .trim()
    .replace(/^#+/, "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase()
}

export function extractNoteTagNames(contentText: string) {
  const tags = new Map<string, string>()
  for (const match of contentText.matchAll(TAG_PATTERN)) {
    const displayName = match[1]?.trim()
    if (!displayName) continue
    const normalizedName = normalizeNoteTagName(displayName)
    if (!normalizedName || tags.has(normalizedName)) continue
    tags.set(normalizedName, displayName)
  }
  return [...tags].map(([normalizedName, name]) => ({ name, normalizedName }))
}

export function deriveNoteContentFeatures(content: string) {
  return {
    hasChecklist:
      /data-type=["']taskList["']/i.test(content) ||
      /data-checked=["'](?:true|false)["']/i.test(content),
    hasAttachment:
      /<img\b/i.test(content) || /data-note-drawing-id=["'][0-9a-f-]{36}["']/i.test(content),
  }
}

export function isValidUpdatedWithinDays(value: number | null | undefined) {
  return value == null || NOTE_UPDATED_WITHIN_OPTIONS.includes(value as (typeof NOTE_UPDATED_WITHIN_OPTIONS)[number])
}

export function matchesNoteSmartFolder(
  note: SmartFolderComparableNote,
  criteria: NoteSmartFolderCriteria,
  now = new Date()
) {
  const checks: boolean[] = []

  if (criteria.tagIds.length) {
    const noteTags = new Set(note.tagIds)
    const tagMatches = criteria.tagIds.map((tagId) => noteTags.has(tagId))
    checks.push(criteria.matchMode === "all" ? tagMatches.every(Boolean) : tagMatches.some(Boolean))
  }
  if (criteria.requirePinned != null) checks.push(note.pinned === criteria.requirePinned)
  if (criteria.requireChecklist != null) checks.push(note.hasChecklist === criteria.requireChecklist)
  if (criteria.requireAttachment != null) checks.push(note.hasAttachment === criteria.requireAttachment)
  if (criteria.updatedWithinDays != null) {
    const threshold = now.getTime() - criteria.updatedWithinDays * 24 * 60 * 60 * 1000
    checks.push(new Date(note.updatedAt).getTime() >= threshold)
  }

  if (!checks.length) return true
  return criteria.matchMode === "all" ? checks.every(Boolean) : checks.some(Boolean)
}

export function getNoteRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - NOTE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}
