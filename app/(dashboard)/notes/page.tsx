import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { NotesWorkspace } from "@/components/notes/notes-workspace"
import type { NoteRecord } from "@/lib/actions/notes"

export const dynamic = "force-dynamic"

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
        title: string
        content: string
        contentText: string
        archived: boolean
        pinned: boolean
        createdAt: Date
        updatedAt: Date
      }>>
    }
  }).note

  const [notes, projectNotesRaw, taskNotesRaw] = await Promise.all([
    noteDelegate && typeof noteDelegate.findMany === "function"
      ? await noteDelegate.findMany({
          where: { tenantId: session.tenantId },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          take: 400,
        })
      : [],
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
            name: true,
            site: { select: { domainName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ])

  const personalNotes: NoteRecord[] = notes.map((note) => ({
    id: note.id,
    tenantId: note.tenantId,
    userId: note.userId,
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
      storageUnavailable={!noteDelegate}
    />
  )
}
