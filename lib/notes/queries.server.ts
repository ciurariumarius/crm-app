import prisma from "@/lib/prisma"
import { hasMeaningfulRichTextContent } from "@/lib/notes/content"

export type NotesView = "all" | "tasks-and-projects" | `folder:${string}`

export type NoteSourceType = "personal" | "task" | "project"

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
  sourceType?: NoteSourceType
  sourceId?: string
  sourceLabel?: string | null
  sourceBadge?: string | null
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

export function toContentText(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|div|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
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
    sourceType: "personal",
  }
}

export async function queryPersonalNoteList(input: NoteListQueryInput = {}) {
  const q = input.q?.trim().slice(0, 200) || ""
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 50))
  const requestedView = input.view ?? "all"

  if (requestedView === "tasks-and-projects") {
    const [tasks, projects] = await Promise.all([
      prisma.task.findMany({
        where: {
          AND: [
            { description: { not: null } },
            { description: { not: "" } },
            ...(q
              ? [
                  {
                    OR: [
                      { name: { contains: q } },
                      { description: { contains: q } },
                      { project: { name: { contains: q } } },
                      { project: { site: { domainName: { contains: q } } } },
                    ],
                  },
                ]
              : []),
          ],
        },
        include: {
          project: {
            include: {
              site: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
      prisma.project.findMany({
        where: {
          AND: [
            { description: { not: null } },
            { description: { not: "" } },
            ...(q
              ? [
                  {
                    OR: [
                      { name: { contains: q } },
                      { description: { contains: q } },
                      { site: { domainName: { contains: q } } },
                    ],
                  },
                ]
              : []),
          ],
        },
        include: {
          site: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    ])

    const taskRows: NoteListRow[] = tasks
      .filter((task) => hasMeaningfulRichTextContent(task.description))
      .map((task) => {
        const text = toContentText(task.description || "")
        const projectName = task.project?.name || task.project?.site?.domainName || ""
        return {
          id: `task:${task.id}`,
          folderId: null,
          title: task.name || "Task Note",
          preview: text.slice(0, 180),
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          sourceType: "task",
          sourceId: task.id,
          sourceLabel: projectName || null,
          sourceBadge: "T",
        }
      })

    const projectRows: NoteListRow[] = projects
      .filter((project) => hasMeaningfulRichTextContent(project.description))
      .map((project) => {
        const text = toContentText(project.description || "")
        const domain = project.site?.domainName || ""
        const title = project.name || domain || "Project Note"
        return {
          id: `project:${project.id}`,
          folderId: null,
          title,
          preview: text.slice(0, 180),
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          sourceType: "project",
          sourceId: project.id,
          sourceLabel: domain || null,
          sourceBadge: "P",
        }
      })

    const combined = [...taskRows, ...projectRows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    const totalCount = combined.length
    const page = combined.slice(0, pageSize)

    return {
      rows: page,
      totalCount,
      nextCursor: null,
    }
  }

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
  if (noteId.startsWith("task:")) {
    const taskId = noteId.slice("task:".length)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            site: true,
          },
        },
      },
    })
    if (!task) return null
    const content = task.description || ""
    const contentText = toContentText(content)
    const projectName = task.project?.name || task.project?.site?.domainName || ""
    return {
      id: `task:${task.id}`,
      folderId: null,
      title: task.name || "Task Note",
      preview: contentText.slice(0, 180),
      content,
      contentText,
      contentRevision: 1,
      hasChecklist: /data-type=["']taskList["']/i.test(content),
      hasAttachment: /<img\b|data-type=["']file-attachment["']/i.test(content),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      sourceType: "task",
      sourceId: task.id,
      sourceLabel: projectName || null,
      sourceBadge: "T",
    }
  }

  if (noteId.startsWith("project:")) {
    const projectId = noteId.slice("project:".length)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        site: true,
      },
    })
    if (!project) return null
    const content = project.description || ""
    const contentText = toContentText(content)
    const domain = project.site?.domainName || ""
    const title = project.name || domain || "Project Note"
    return {
      id: `project:${project.id}`,
      folderId: null,
      title,
      preview: contentText.slice(0, 180),
      content,
      contentText,
      contentRevision: 1,
      hasChecklist: /data-type=["']taskList["']/i.test(content),
      hasAttachment: /<img\b|data-type=["']file-attachment["']/i.test(content),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      sourceType: "project",
      sourceId: project.id,
      sourceLabel: domain || null,
      sourceBadge: "P",
    }
  }

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
    sourceType: "personal",
  }
}

export async function getNotesWorkspaceBootstrap(input: {
  view?: NotesView
  selectedNoteId?: string | null
  skipSelectedNote?: boolean
} = {}) {
  const [folders, folderCounts, page, tasksWithNotes, projectsWithNotes] = await Promise.all([
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
    prisma.task.findMany({
      where: {
        AND: [
          { description: { not: null } },
          { description: { not: "" } },
        ],
      },
      select: { description: true },
    }),
    prisma.project.findMany({
      where: {
        AND: [
          { description: { not: null } },
          { description: { not: "" } },
        ],
      },
      select: { description: true },
    }),
  ])
  const counts = new Map(folderCounts.map((row) => [row.folderId, row._count._all]))
  const allCount = folderCounts.reduce((sum, row) => sum + row._count._all, 0)
  const meaningfulTasksCount = tasksWithNotes.filter((t) => hasMeaningfulRichTextContent(t.description)).length
  const meaningfulProjectsCount = projectsWithNotes.filter((p) => hasMeaningfulRichTextContent(p.description)).length
  const tasksAndProjectsCount = meaningfulTasksCount + meaningfulProjectsCount

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
    tasksAndProjectsCount,
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

