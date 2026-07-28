import prisma from "@/lib/prisma"
import { matchesNoteSmartFolder } from "@/lib/notes/apple-notes"

export type NotesQueryView =
  | "all"
  | "pinned"
  | "archived"
  | "deleted"
  | `folder:${string}`
  | `tag:${string}`
  | `smart:${string}`

export type NotesQuerySort = "modified" | "created" | "title"

export type NoteListQueryInput = {
  view?: NotesQueryView
  q?: string
  searchScope?: "view" | "all"
  sort?: NotesQuerySort
  cursor?: string | null
  pageSize?: number
}

export type NoteListRow = {
  id: string
  folderId: string | null
  title: string
  preview: string
  pinned: boolean
  archived: boolean
  deletedAt: string | null
  hasChecklist: boolean
  hasAttachment: boolean
  attachmentPreview: string | null
  tagIds: string[]
  createdAt: string
  updatedAt: string
}

function firstImageSrc(content: string) {
  return content.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null
}

function serializeListRow(note: {
  id: string
  folderId: string | null
  title: string
  content: string
  contentText: string
  pinned: boolean
  archived: boolean
  deletedAt: Date | null
  hasChecklist: boolean
  hasAttachment: boolean
  createdAt: Date
  updatedAt: Date
  tags: Array<{ tagId: string }>
}): NoteListRow {
  return {
    id: note.id,
    folderId: note.folderId,
    title: note.title,
    preview: note.contentText.slice(0, 180),
    pinned: note.pinned,
    archived: note.archived,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    hasChecklist: note.hasChecklist,
    hasAttachment: note.hasAttachment,
    attachmentPreview: note.hasAttachment ? firstImageSrc(note.content) : null,
    tagIds: note.tags.map((tag) => tag.tagId),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

function buildBaseWhere(view: NotesQueryView) {
  if (view === "pinned") return { archived: false, deletedAt: null, pinned: true }
  if (view === "archived") return { archived: true, deletedAt: null }
  if (view === "deleted") return { deletedAt: { not: null } }
  if (view.startsWith("folder:")) {
    return {
      archived: false,
      deletedAt: null,
      folderId: view.slice("folder:".length),
    }
  }
  if (view.startsWith("tag:")) {
    return {
      archived: false,
      deletedAt: null,
      tags: { some: { tagId: view.slice("tag:".length) } },
    }
  }
  return { archived: false, deletedAt: null }
}

export async function queryPersonalNoteList(input: NoteListQueryInput = {}) {
  const view = input.view ?? "all"
  const searchScope = input.searchScope ?? "view"
  const q = input.q?.trim().slice(0, 200) || ""
  const sort = input.sort ?? "modified"
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 50))
  const smartFolderId = view.startsWith("smart:") ? view.slice("smart:".length) : null
  const where = {
    ...(searchScope === "all" && q
      ? { archived: false, deletedAt: null }
      : buildBaseWhere(view)),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { contentText: { contains: q } },
          ],
        }
      : {}),
  }

  const orderBy =
    sort === "title"
      ? [{ title: "asc" as const }, { id: "asc" as const }]
      : sort === "created"
        ? [{ createdAt: "desc" as const }, { id: "desc" as const }]
        : [{ pinned: "desc" as const }, { updatedAt: "desc" as const }, { id: "desc" as const }]

  const queryTake = smartFolderId ? 500 : pageSize + 1
  const rows = await prisma.note.findMany({
    where,
    include: {
      tags: { select: { tagId: true } },
    },
    orderBy,
    ...(input.cursor && !smartFolderId
      ? { cursor: { id: input.cursor }, skip: 1 }
      : {}),
    take: queryTake,
  })

  let filtered = rows
  if (smartFolderId) {
    const smartFolder = await prisma.noteSmartFolder.findUnique({
      where: { id: smartFolderId },
      include: { tags: { select: { tagId: true } } },
    })
    filtered = smartFolder
      ? rows.filter((note) =>
          matchesNoteSmartFolder(
            {
              pinned: note.pinned,
              hasChecklist: note.hasChecklist,
              hasAttachment: note.hasAttachment,
              updatedAt: note.updatedAt,
              tagIds: note.tags.map((tag) => tag.tagId),
            },
            {
              matchMode: smartFolder.matchMode === "any" ? "any" : "all",
              tagIds: smartFolder.tags.map((tag) => tag.tagId),
              requirePinned: smartFolder.requirePinned,
              requireChecklist: smartFolder.requireChecklist,
              requireAttachment: smartFolder.requireAttachment,
              updatedWithinDays: smartFolder.updatedWithinDays as 1 | 7 | 30 | 90 | null,
            }
          )
        )
      : []
  }

  const page = filtered.slice(0, pageSize)
  return {
    rows: page.map(serializeListRow),
    pageSize,
    nextCursor:
      filtered.length > pageSize && page.length
        ? page[page.length - 1]?.id ?? null
        : null,
  }
}

export async function getPersonalNoteDetail(noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      tags: {
        include: { tag: true },
        orderBy: { tag: { normalizedName: "asc" } },
      },
    },
  })
  if (!note) return null
  return {
    id: note.id,
    folderId: note.folderId,
    title: note.title,
    content: note.content,
    contentText: note.contentText,
    pinned: note.pinned,
    archived: note.archived,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    hasChecklist: note.hasChecklist,
    hasAttachment: note.hasAttachment,
    tags: note.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      normalizedName: tag.normalizedName,
    })),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

export async function getNotesWorkspaceBootstrap() {
  const [folders, tags, smartFolders, all, pinned, archived, deleted] =
    await Promise.all([
      prisma.noteFolder.findMany({
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.noteTag.findMany({
        orderBy: { normalizedName: "asc" },
        include: {
          _count: {
            select: {
              notes: {
                where: { note: { archived: false, deletedAt: null } },
              },
            },
          },
        },
      }),
      prisma.noteSmartFolder.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { tags: { include: { tag: true } } },
      }),
      prisma.note.count({ where: { archived: false, deletedAt: null } }),
      prisma.note.count({ where: { archived: false, deletedAt: null, pinned: true } }),
      prisma.note.count({ where: { archived: true, deletedAt: null } }),
      prisma.note.count({ where: { deletedAt: { not: null } } }),
    ])

  return {
    folders,
    tags: tags.map((tag) => ({ ...tag, count: tag._count.notes })),
    smartFolders,
    counts: { all, pinned, archived, deleted },
  }
}
