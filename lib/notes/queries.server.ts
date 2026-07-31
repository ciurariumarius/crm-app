import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

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

function buildBaseWhere(view: NotesQueryView): Prisma.NoteWhereInput {
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

function buildSmartFolderWhere(smartFolder: {
  matchMode: string
  requirePinned: boolean | null
  requireChecklist: boolean | null
  requireAttachment: boolean | null
  updatedWithinDays: number | null
  tags: Array<{ tagId: string }>
}): Prisma.NoteWhereInput {
  const tagIds = smartFolder.tags.map((tag) => tag.tagId)
  const checks: Prisma.NoteWhereInput[] = []

  if (tagIds.length) {
    if (smartFolder.matchMode === "all") {
      checks.push(
        ...tagIds.map((tagId) => ({
          tags: { some: { tagId } },
        }))
      )
    } else {
      checks.push({ tags: { some: { tagId: { in: tagIds } } } })
    }
  }
  if (smartFolder.requirePinned != null) {
    checks.push({ pinned: smartFolder.requirePinned })
  }
  if (smartFolder.requireChecklist != null) {
    checks.push({ hasChecklist: smartFolder.requireChecklist })
  }
  if (smartFolder.requireAttachment != null) {
    checks.push({ hasAttachment: smartFolder.requireAttachment })
  }
  if (smartFolder.updatedWithinDays != null) {
    checks.push({
      updatedAt: {
        gte: new Date(
          Date.now() - smartFolder.updatedWithinDays * 24 * 60 * 60 * 1000
        ),
      },
    })
  }

  return {
    archived: false,
    deletedAt: null,
    ...(smartFolder.matchMode === "any" ? { OR: checks } : { AND: checks }),
  }
}

export async function queryPersonalNoteList(input: NoteListQueryInput = {}) {
  const view = input.view ?? "all"
  const searchScope = input.searchScope ?? "view"
  const q = input.q?.trim().slice(0, 200) || ""
  const sort = input.sort ?? "modified"
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 50))
  const smartFolderId =
    searchScope === "view" && view.startsWith("smart:")
      ? view.slice("smart:".length)
      : null
  const smartFolder = smartFolderId
    ? await prisma.noteSmartFolder.findUnique({
        where: { id: smartFolderId },
        include: { tags: { select: { tagId: true } } },
      })
    : null

  const scopedWhere: Prisma.NoteWhereInput =
    searchScope === "all"
      ? { archived: false, deletedAt: null }
      : smartFolderId
        ? smartFolder
          ? buildSmartFolderWhere(smartFolder)
          : { id: "__missing_smart_folder__" }
        : buildBaseWhere(view)

  const searchWhere: Prisma.NoteWhereInput | null = q
    ? {
        OR: [
          { title: { contains: q } },
          { contentText: { contains: q } },
        ],
      }
    : null
  const where: Prisma.NoteWhereInput = searchWhere
    ? { AND: [scopedWhere, searchWhere] }
    : scopedWhere

  const orderBy =
    sort === "title"
      ? [{ title: "asc" as const }, { id: "asc" as const }]
      : sort === "created"
        ? [{ createdAt: "desc" as const }, { id: "desc" as const }]
        : [{ pinned: "desc" as const }, { updatedAt: "desc" as const }, { id: "desc" as const }]

  const rows = await prisma.note.findMany({
    where,
    include: {
      tags: { select: { tagId: true } },
    },
    orderBy,
    ...(input.cursor
      ? { cursor: { id: input.cursor }, skip: 1 }
      : {}),
    take: pageSize + 1,
  })

  const page = rows.slice(0, pageSize)
  return {
    rows: page.map(serializeListRow),
    pageSize,
    nextCursor:
      rows.length > pageSize && page.length
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
