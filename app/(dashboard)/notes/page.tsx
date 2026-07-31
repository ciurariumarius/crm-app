import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { NotesWorkspace } from "@/components/notes/notes-workspace"
import type {
  NoteFolderRecord,
  NoteRecord,
  NoteSmartFolderRecord,
  NoteTagRecord,
} from "@/lib/actions/notes"

export const dynamic = "force-dynamic"
const DEFAULT_NOTES_FOLDER_NAME = "General"

function toContentText(content: string) {
  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function sortUnifiedNotes(items: NoteRecord[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ note?: string; view?: string; scope?: string }>
}) {
  await requireAuth()
  const params = (await searchParams) || {}
  const noteDelegate = (prisma as unknown as {
    note?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        id: string
        folderId?: string | null
        title: string
        content: string
        contentText: string
        archived: boolean
        pinned: boolean
        deletedAt?: Date | null
        hasChecklist?: boolean
        hasAttachment?: boolean
        createdAt: Date
        updatedAt: Date
        tags?: Array<{
          tag: {
            id: string
            name: string
            normalizedName: string
          }
        }>
      }>>
    }
    noteFolder?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        id: string
        parentId?: string | null
        name: string
        isDefault: boolean
        sortOrder?: number
        createdAt: Date
        updatedAt: Date
      }>>
      create?: (...args: unknown[]) => Promise<{
        id: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>
      update?: (...args: unknown[]) => Promise<{
        id: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>
      updateMany?: (...args: unknown[]) => Promise<unknown>
    }
  }).note
  const noteFolderDelegate = (prisma as unknown as {
    noteFolder?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        id: string
        parentId?: string | null
        name: string
        isDefault: boolean
        sortOrder?: number
        createdAt: Date
        updatedAt: Date
      }>>
      create?: (...args: unknown[]) => Promise<{
        id: string
        parentId?: string | null
        name: string
        isDefault: boolean
        sortOrder?: number
        createdAt: Date
        updatedAt: Date
      }>
      update?: (...args: unknown[]) => Promise<{
        id: string
        parentId?: string | null
        name: string
        isDefault: boolean
        sortOrder?: number
        createdAt: Date
        updatedAt: Date
      }>
      updateMany?: (...args: unknown[]) => Promise<unknown>
    }
  }).noteFolder

  const [notes, foldersRawMaybe, tagsRawMaybe, smartFoldersRawMaybe, projectNotesRaw, taskNotesRaw] = await Promise.all([
    noteDelegate && typeof noteDelegate.findMany === "function"
      ? await noteDelegate.findMany({
          include: {
            tags: {
              include: { tag: true },
            },
          },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          take: 500,
        })
      : [],
    noteFolderDelegate && typeof noteFolderDelegate.findMany === "function"
      ? await (async () => {
          try {
            return await noteFolderDelegate.findMany({
              orderBy: [
                { parentId: "asc" },
                { sortOrder: "asc" },
                { isDefault: "desc" },
                { name: "asc" },
              ],
            })
          } catch {
            return null
          }
        })()
      : null,
    (async () => {
      try {
        return await prisma.noteTag.findMany({
          orderBy: { normalizedName: "asc" },
          include: {
            _count: {
              select: {
                notes: {
                  where: {
                    note: { deletedAt: null, archived: false },
                  },
                },
              },
            },
          },
        })
      } catch {
        return null
      }
    })(),
    (async () => {
      try {
        return await prisma.noteSmartFolder.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            tags: {
              include: { tag: true },
            },
          },
        })
      } catch {
        return null
      }
    })(),
    prisma.project.findMany({
      where: { description: { not: null } },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { domainName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
    prisma.task.findMany({
      where: { description: { not: null } },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            site: { select: { domainName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ])

  const folderFeatureReady = Boolean(noteFolderDelegate) && Array.isArray(foldersRawMaybe)
  const foldersRaw = Array.isArray(foldersRawMaybe) ? [...foldersRawMaybe] : []
  if (
    folderFeatureReady &&
    foldersRaw.length === 0 &&
    noteFolderDelegate &&
    typeof noteFolderDelegate.create === "function"
  ) {
    try {
      const createdDefault = await noteFolderDelegate.create({
        data: {
          name: DEFAULT_NOTES_FOLDER_NAME,
          isDefault: true,
          sortOrder: 0,
        },
      })
      foldersRaw.push(createdDefault)
    } catch {
      // Non-blocking: notes still render even if default folder bootstrap fails.
    }
  }
  if (folderFeatureReady && foldersRaw.length > 0) {
    const defaultFolders = foldersRaw.filter((folder) => folder.isDefault)
    const candidateDefault =
      defaultFolders[0] ??
      foldersRaw.find((folder) => folder.name.trim().toLocaleLowerCase() === DEFAULT_NOTES_FOLDER_NAME.toLocaleLowerCase()) ??
      foldersRaw[0]

    if (candidateDefault && noteFolderDelegate && typeof noteFolderDelegate.update === "function") {
      if (defaultFolders.length === 0) {
        try {
          const updated = await noteFolderDelegate.update({
            where: { id: candidateDefault.id },
            data: { isDefault: true },
          })
          const idx = foldersRaw.findIndex((folder) => folder.id === updated.id)
          if (idx >= 0) foldersRaw[idx] = updated
        } catch {
          // Non-blocking
        }
      } else if (defaultFolders.length > 1 && noteFolderDelegate && typeof noteFolderDelegate.updateMany === "function") {
        try {
          await noteFolderDelegate.updateMany({
            where: {
              isDefault: true,
              id: { not: candidateDefault.id },
            },
            data: { isDefault: false },
          })
          const candidateId = candidateDefault.id
          for (let index = 0; index < foldersRaw.length; index += 1) {
            const folder = foldersRaw[index]
            foldersRaw[index] = {
              ...folder,
              isDefault: folder.id === candidateId,
            }
          }
        } catch {
          // Non-blocking
        }
      }
    }
  }

  const folders: NoteFolderRecord[] = foldersRaw.map((folder) => ({
    id: folder.id,
    parentId: folder.parentId ?? null,
    name: folder.name,
    isDefault: folder.isDefault,
    sortOrder: folder.sortOrder ?? 1000,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  }))
  const defaultFolder = folders.find((folder) => folder.isDefault) ?? null

  const personalNotes: NoteRecord[] = notes.map((note) => ({
    id: note.id,
    folderId: note.folderId ?? defaultFolder?.id ?? null,
    folderName:
      foldersRaw.find((folder) => folder.id === (note.folderId ?? null))?.name ||
      defaultFolder?.name ||
      null,
    title: note.title,
    content: note.content,
    contentText: note.contentText,
    archived: note.archived,
    pinned: note.pinned,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    hasChecklist: note.hasChecklist ?? false,
    hasAttachment: note.hasAttachment ?? /<img\b/i.test(note.content),
    tags:
      note.tags?.map(({ tag }) => ({
        id: tag.id,
        name: tag.name,
        normalizedName: tag.normalizedName,
      })) ?? [],
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    sourceType: "note",
  }))

  const projectNotes: NoteRecord[] = projectNotesRaw
    .filter((item) => Boolean(item.description?.trim()))
    .map((project) => {
      const content = project.description?.trim() || ""
      const domainName = project.site?.domainName?.trim() || "Unknown domain"
      const projectName = project.name?.trim() || domainName
      return {
        id: `project:${project.id}`,
        title: projectName,
        content,
        contentText: toContentText(content),
        archived: false,
        pinned: false,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        sourceType: "project",
        sourceId: project.id,
        sourceLabel: domainName,
      }
    })

  const taskNotes: NoteRecord[] = taskNotesRaw
    .filter((item) => Boolean(item.description?.trim()))
    .map((task) => {
      const content = task.description?.trim() || ""
      const domainName = task.project?.site?.domainName?.trim() || "Unknown domain"
      const taskName = task.name?.trim() || "Task"
      return {
        id: `task:${task.id}`,
        title: taskName,
        content,
        contentText: toContentText(content),
        archived: false,
        pinned: false,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        sourceType: "task",
        sourceId: task.id,
        sourceProjectId: task.project?.id || undefined,
        sourceLabel: domainName,
      }
    })

  const tags: NoteTagRecord[] = Array.isArray(tagsRawMaybe)
    ? tagsRawMaybe.map((tag) => ({
        id: tag.id,
        name: tag.name,
        normalizedName: tag.normalizedName,
        count: tag._count.notes,
      }))
    : []

  const smartFolders: NoteSmartFolderRecord[] = Array.isArray(smartFoldersRawMaybe)
    ? smartFoldersRawMaybe.map((folder) => ({
        id: folder.id,
        name: folder.name,
        matchMode: folder.matchMode === "any" ? "any" : "all",
        requirePinned: folder.requirePinned,
        requireChecklist: folder.requireChecklist,
        requireAttachment: folder.requireAttachment,
        updatedWithinDays: folder.updatedWithinDays,
        sortOrder: folder.sortOrder,
        tags: folder.tags.map(({ tag }) => ({
          id: tag.id,
          name: tag.name,
          normalizedName: tag.normalizedName,
        })),
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString(),
      }))
    : []

  const initialNotes = sortUnifiedNotes([
    ...personalNotes,
    ...projectNotes,
    ...taskNotes,
  ])

  const requestedNoteId = params.note || null
  const hasRequested = requestedNoteId ? initialNotes.some((note) => note.id === requestedNoteId) : false
  const initialSelectedNoteId =
    (hasRequested ? requestedNoteId : null) ??
    initialNotes.find((note) => !note.archived)?.id ??
    initialNotes[0]?.id ??
    null
  const requestedNote = initialSelectedNoteId
    ? initialNotes.find((note) => note.id === initialSelectedNoteId)
    : null
  const resolvedInitialView =
    params.view ||
    (requestedNote?.sourceType === "project"
      ? "projects"
      : requestedNote?.sourceType === "task"
        ? "tasks"
        : requestedNote?.deletedAt
          ? "deleted"
          : requestedNote?.archived
            ? "archived"
            : "all")

  return (
    <NotesWorkspace
      initialNotes={initialNotes}
      initialSelectedNoteId={initialSelectedNoteId}
      initialView={resolvedInitialView}
      initialSearchScope={params.scope === "all" ? "all" : "view"}
      initialFolders={folders}
      initialTags={tags}
      initialSmartFolders={smartFolders}
      foldersEnabled={folderFeatureReady}
      productivityFeaturesEnabled={Array.isArray(tagsRawMaybe) && Array.isArray(smartFoldersRawMaybe)}
      storageUnavailable={!noteDelegate}
    />
  )
}
