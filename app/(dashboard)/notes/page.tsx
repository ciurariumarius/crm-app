import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { NotesWorkspace } from "@/components/notes/notes-workspace"
import type { NoteFolderRecord, NoteRecord } from "@/lib/actions/notes"
import { hasMeaningfulRichTextContent } from "@/lib/notes/content"

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
  searchParams?: Promise<{ note?: string; view?: string }>
}) {
  await requireAuth()
  const params = (await searchParams) || {}
  const [notes, foldersRawInitial, projectNotesRaw, taskNotesRaw] = await Promise.all([
    prisma.note.findMany({
      include: { tags: { include: { tag: true } } },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.noteFolder.findMany({
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
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

  const projectNotes: NoteRecord[] = projectNotesRaw
    .filter((project) => hasMeaningfulRichTextContent(project.description))
    .map((project) => {
      const content = project.description || ""
      const domainName = project.site.domainName.trim() || "Unknown domain"
      return {
        id: `project:${project.id}`,
        title: project.name?.trim() || domainName,
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
    .filter((task) => hasMeaningfulRichTextContent(task.description))
    .map((task) => {
      const content = task.description?.trim() || ""
      const domainName = task.project?.site.domainName?.trim() || "LMS"
      return {
        id: `task:${task.id}`,
        title: task.name.trim() || "Task",
        content,
        contentText: toContentText(content),
        archived: false,
        pinned: false,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        sourceType: "task",
        sourceId: task.id,
        sourceProjectId: task.project?.id,
        sourceLabel: domainName,
      }
    })

  const initialNotes = sortUnifiedNotes([...personalNotes, ...projectNotes, ...taskNotes])
  const requestedNoteId = params.note || null
  const requestedNote = requestedNoteId ? initialNotes.find((note) => note.id === requestedNoteId) : null
  const initialSelectedNoteId = requestedNote?.id ?? initialNotes.find((note) => !note.archived && !note.deletedAt)?.id ?? initialNotes[0]?.id ?? null
  const requestedView = params.view || ""
  const allowedView = ["all", "pinned", "archived", "deleted", "projects", "tasks"].includes(requestedView) || requestedView.startsWith("folder:")
  const initialView = allowedView
    ? requestedView
    : requestedNote?.sourceType === "project"
      ? "projects"
      : requestedNote?.sourceType === "task"
        ? "tasks"
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
    />
  )
}
