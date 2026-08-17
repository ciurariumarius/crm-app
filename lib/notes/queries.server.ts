import prisma from "@/lib/prisma"

export type NotesView = "all" | `folder:${string}`

export type NoteListQueryInput = {
  view?: NotesView
  q?: string
  cursor?: string | null
  pageSize?: number
}

export type NoteListRow = {
  id: string
  folderId: string | null
  title: string
  preview: string
  createdAt: string
  updatedAt: string
}

export type NoteDetail = NoteListRow & {
  content: string
  contentText: string
  contentRevision: number
  hasChecklist: boolean
  hasAttachment: boolean
}

export type NoteFolderRecord = {
  id: string
  name: string
  sortOrder: number
  count: number
  createdAt: string
  updatedAt: string
}

function serializeListRow(note: {
  id: string
  folderId: string | null
  title: string
  contentText: string
  createdAt: Date
  updatedAt: Date
}): NoteListRow {
  return {
    id: note.id,
    folderId: note.folderId,
    title: note.title,
    preview: note.contentText.slice(0, 180),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

export async function queryPersonalNoteList(input: NoteListQueryInput = {}) {
  const q = input.q?.trim().slice(0, 200) || ""
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 50))
  const requestedView = input.view ?? "all"
  const folderId = requestedView.startsWith("folder:")
    ? requestedView.slice("folder:".length)
    : null
  const where = q
    ? {
        OR: [
          { title: { contains: q } },
          { contentText: { contains: q } },
        ],
      }
    : folderId
      ? { folderId }
      : {}

  const [rows, totalCount] = await Promise.all([
    prisma.note.findMany({
      where,
      select: {
        id: true,
        folderId: true,
        title: true,
        contentText: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: pageSize + 1,
    }),
    prisma.note.count({ where }),
  ])

  const page = rows.slice(0, pageSize)
  return {
    rows: page.map(serializeListRow),
    totalCount,
    nextCursor:
      rows.length > pageSize && page.length
        ? page[page.length - 1]?.id ?? null
        : null,
  }
}

export async function getPersonalNoteDetail(noteId: string): Promise<NoteDetail | null> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      folderId: true,
      title: true,
      content: true,
      contentText: true,
      contentRevision: true,
      hasChecklist: true,
      hasAttachment: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!note) return null
  return {
    ...serializeListRow(note),
    content: note.content,
    contentText: note.contentText,
    contentRevision: note.contentRevision,
    hasChecklist: note.hasChecklist,
    hasAttachment: note.hasAttachment,
  }
}

export async function getNotesWorkspaceBootstrap(input: {
  view?: NotesView
  selectedNoteId?: string | null
  skipSelectedNote?: boolean
} = {}) {
  const [folders, folderCounts, page] = await Promise.all([
    prisma.noteFolder.findMany({
      select: {
        id: true,
        name: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.note.groupBy({
      by: ["folderId"],
      _count: { _all: true },
    }),
    queryPersonalNoteList({ view: input.view, pageSize: 50 }),
  ])
  const counts = new Map(folderCounts.map((row) => [row.folderId, row._count._all]))
  const allCount = folderCounts.reduce((sum, row) => sum + row._count._all, 0)
  const requestedSelectedId = input.skipSelectedNote
    ? null
    : input.selectedNoteId || page.rows[0]?.id || null
  const requestedSelectedNote = requestedSelectedId
    ? await getPersonalNoteDetail(requestedSelectedId)
    : null
  const selectedNote = input.skipSelectedNote
    ? null
    : requestedSelectedNote
      ?? (page.rows[0]?.id && page.rows[0].id !== requestedSelectedId
        ? await getPersonalNoteDetail(page.rows[0].id)
        : null)
  const rows = selectedNote && !page.rows.some((row) => row.id === selectedNote.id)
    ? [selectedNote, ...page.rows]
    : page.rows

  return {
    ...page,
    rows,
    allCount,
    selectedNote,
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder,
      count: counts.get(folder.id) ?? 0,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    })) satisfies NoteFolderRecord[],
  }
}
