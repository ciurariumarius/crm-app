import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { NotesWorkspace } from "@/components/notes/notes-workspace"
import type { NoteFolderRecord, NoteRecord } from "@/lib/actions/notes"

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
  searchParams?: Promise<{ note?: string }>
}) {
  const session = await requireTenantContext()
  const params = (await searchParams) || {}
  const noteDelegate = (prisma as unknown as {
    note?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        id: string
        tenantId: string
        userId: string
        folderId?: string | null
        title: string
        content: string
        contentText: string
        archived: boolean
        pinned: boolean
        createdAt: Date
        updatedAt: Date
      }>>
    }
    noteFolder?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        id: string
        tenantId: string
        userId: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>>
      create?: (...args: unknown[]) => Promise<{
        id: string
        tenantId: string
        userId: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>
      update?: (...args: unknown[]) => Promise<{
        id: string
        tenantId: string
        userId: string
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
        tenantId: string
        userId: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>>
      create?: (...args: unknown[]) => Promise<{
        id: string
        tenantId: string
        userId: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>
      update?: (...args: unknown[]) => Promise<{
        id: string
        tenantId: string
        userId: string
        name: string
        isDefault: boolean
        createdAt: Date
        updatedAt: Date
      }>
      updateMany?: (...args: unknown[]) => Promise<unknown>
    }
  }).noteFolder

  const [notes, foldersRawMaybe, projectNotesRaw, taskNotesRaw] = await Promise.all([
    noteDelegate && typeof noteDelegate.findMany === "function"
      ? await noteDelegate.findMany({
          where: { tenantId: session.tenantId },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          take: 400,
        })
      : [],
    noteFolderDelegate && typeof noteFolderDelegate.findMany === "function"
      ? await (async () => {
          try {
            return await noteFolderDelegate.findMany({
              where: { tenantId: session.tenantId },
              orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            })
          } catch {
            return null
          }
        })()
      : null,
    prisma.project.findMany({
      where: { tenantId: session.tenantId, description: { not: null } },
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
      where: { tenantId: session.tenantId, description: { not: null } },
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
          tenantId: session.tenantId,
          userId: session.userId,
          name: DEFAULT_NOTES_FOLDER_NAME,
          isDefault: true,
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
              tenantId: session.tenantId,
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
    tenantId: folder.tenantId,
    userId: folder.userId,
    name: folder.name,
    isDefault: folder.isDefault,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  }))
  const defaultFolder = folders.find((folder) => folder.isDefault) ?? null

  const personalNotes: NoteRecord[] = notes.map((note) => ({
    id: note.id,
    tenantId: note.tenantId,
    userId: note.userId,
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
        tenantId: session.tenantId,
        userId: session.userId,
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
        tenantId: session.tenantId,
        userId: session.userId,
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

  return (
    <NotesWorkspace
      initialNotes={initialNotes}
      initialSelectedNoteId={initialSelectedNoteId}
      initialFolders={folders}
      foldersEnabled={folderFeatureReady}
      storageUnavailable={!noteDelegate}
    />
  )
}
