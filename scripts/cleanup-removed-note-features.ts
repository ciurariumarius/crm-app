import "dotenv/config"

import { unlink } from "node:fs/promises"
import prisma from "../lib/prisma"
import { resolveProjectNoteAbsolutePath } from "../lib/project-note-storage"
import { deriveNoteTitleFromContent } from "../lib/notes/derived-note-text"

const DRAWING_NODE_PATTERN = /<(div|figure)\b(?=[^>]*\bdata-note-drawing-id=["'][^"']+["'])[^>]*>[\s\S]*?<\/\1>/gi
const DRAWING_NODE_SELF_CLOSING_PATTERN = /<(?:div|figure)\b(?=[^>]*\bdata-note-drawing-id=["'][^"']+["'])[^>]*\/>/gi

function removeDrawingNodes(value: string | null) {
  return (value || "")
    .replace(DRAWING_NODE_PATTERN, "")
    .replace(DRAWING_NODE_SELF_CLOSING_PATTERN, "")
}

function toContentText(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function tableExists(name: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    name
  )
  return rows.length > 0
}

async function cleanOwnerTable(
  table: "projects" | "tasks",
  column: "description"
) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; description: string | null }>>(
    `SELECT id, ${column} AS description FROM ${table} WHERE ${column} LIKE '%data-note-drawing-id%'`
  )
  for (const row of rows) {
    const cleaned = removeDrawingNodes(row.description)
    await prisma.$executeRawUnsafe(
      `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
      cleaned || null,
      row.id
    )
  }
  return rows.length
}

async function main() {
  if (!(await tableExists("note_drawings"))) {
    console.log("Note drawings are already removed.")
    return
  }

  const previews = await prisma.$queryRawUnsafe<Array<{ previewPath: string }>>(
    'SELECT "preview_path" AS "previewPath" FROM "note_drawings"'
  )
  const notes = await prisma.$queryRawUnsafe<Array<{ id: string; content: string }>>(
    `SELECT id, content FROM notes WHERE content LIKE '%data-note-drawing-id%'`
  )

  for (const note of notes) {
    const content = removeDrawingNodes(note.content)
    const contentText = toContentText(content)
    await prisma.$executeRawUnsafe(
      `UPDATE notes
       SET content = ?, content_text = ?, title = ?,
           has_checklist = ?, has_attachment = ?
       WHERE id = ?`,
      content,
      contentText,
      deriveNoteTitleFromContent(content),
      /data-type=["']taskList["']|data-checked=["'](?:true|false)["']/i.test(content) ? 1 : 0,
      /<img\b/i.test(content) ? 1 : 0,
      note.id
    )
  }

  const [projects, tasks] = await Promise.all([
    cleanOwnerTable("projects", "description"),
    cleanOwnerTable("tasks", "description"),
  ])

  await Promise.all(
    previews.map(({ previewPath }) =>
      unlink(resolveProjectNoteAbsolutePath(previewPath)).catch(() => undefined)
    )
  )
  await prisma.$executeRawUnsafe('DELETE FROM "note_drawings"')

  console.log(JSON.stringify({ notes: notes.length, projects, tasks, previews: previews.length }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
