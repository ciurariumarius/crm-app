export const ALL_NOTES_FOLDER_LABEL = "All Notes"

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeText(value: string) {
  return escapeAttribute(value).replace(/'/g, "&#39;")
}

export function folderMentionHtml(folder: { id: string; name: string }) {
  return `<span data-note-folder-id="${escapeAttribute(folder.id)}" data-note-folder-label="${escapeAttribute(folder.name)}">#${escapeText(folder.name)}</span>`
}

export function readFolderMentionId(content: string) {
  return content.match(/data-note-folder-id=["']([^"']+)["']/i)?.[1] ?? null
}

export function removeFolderMentions(content: string, folderId?: string) {
  const escapedId = folderId?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const idCheck = escapedId
    ? `(?=[^>]*\\bdata-note-folder-id=["']${escapedId}["'])`
    : "(?=[^>]*\\bdata-note-folder-id=[\"'][^\"']+[\"'])"
  return content.replace(
    new RegExp(`<span\\b${idCheck}[^>]*>[\\s\\S]*?<\\/span>`, "gi"),
    ""
  )
}

export function replaceFolderMentionLabel(
  content: string,
  folder: { id: string; name: string }
) {
  const escapedId = folder.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return content.replace(
    new RegExp(
      `<span\\b(?=[^>]*\\bdata-note-folder-id=["']${escapedId}["'])[^>]*>[\\s\\S]*?<\\/span>`,
      "gi"
    ),
    folderMentionHtml(folder)
  )
}
