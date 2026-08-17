import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { NotesWorkspace } from "@/components/notes/notes-workspace"
import type { NoteFolderRecord, NoteRecord } from "@/lib/actions/notes"

export const dynamic = "force-dynamic"
const DEFAULT_NOTES_FOLDER_NAME = "General"

function sortUnifiedNotes(items: NoteRecord[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ note?: string; view?: string; new?: string }>
}) {
  await requireAuth()
  const params = (await searchParams) || {}
  const startNewNote = params.new === "1"
  const [notes, foldersRawInitial] = await Promise.all([
    prisma.note.findMany({
      include: { tags: { include: { tag: true } } },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.noteFolder.findMany({
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ])

  const foldersRaw = [...foldersRawInitial]
  if (!foldersRaw.length) {
    foldersRaw.push(await prisma.noteFolder.create({
      data: { name: DEFAULT_NOTES_FOLDER_NAME, isDefault: true, sortOrder: 0 },
    }))
  }

  let defaultFolder = foldersRaw.find((folder) => folder.isDefault) ?? foldersRaw[0]
  if (defaultFolder && !defaultFolder.isDefault) {
    defaultFolder = await prisma.noteFolder.update({
      where: { id: defaultFolder.id },
      data: { isDefault: true },
    })
  }

  const folders: NoteFolderRecord[] = foldersRaw
    .map((folder) => ({
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      isDefault: folder.isDefault,
      sortOrder: folder.sortOrder,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))

  const personalNotes: NoteRecord[] = notes.map((note) => ({
    id: note.id,
    folderId: note.folderId ?? defaultFolder?.id ?? null,
    folderName: foldersRaw.find((folder) => folder.id === note.folderId)?.name ?? defaultFolder?.name ?? null,
    title: note.title,
    content: note.content,
    contentText: note.contentText,
    archived: note.archived,
    pinned: note.pinned,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    hasChecklist: note.hasChecklist,
    hasAttachment: note.hasAttachment,
    tags: note.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, normalizedName: tag.normalizedName })),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    sourceType: "note",
  }))

  const initialNotes = sortUnifiedNotes(personalNotes)
  const requestedNoteId = params.note || null
  const requestedNote = requestedNoteId ? initialNotes.find((note) => note.id === requestedNoteId) : null
  const initialSelectedNoteId = startNewNote
    ? null
    : requestedNote?.id ?? initialNotes.find((note) => !note.archived && !note.deletedAt)?.id ?? initialNotes[0]?.id ?? null
  const requestedView = params.view || ""
  const allowedView = ["all", "pinned", "archived", "deleted"].includes(requestedView) || requestedView.startsWith("folder:")
  const initialView = startNewNote
    ? "all"
    : allowedView
      ? requestedView
      : requestedNote?.deletedAt
        ? "deleted"
        : requestedNote?.archived
          ? "archived"
          : "all"

  return (
    <NotesWorkspace
      initialNotes={initialNotes}
      initialSelectedNoteId={initialSelectedNoteId}
      initialView={initialView}
      initialFolders={folders}
      startNewNote={startNewNote}
    />
  )
}
