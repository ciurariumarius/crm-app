import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { NotesWorkspace } from "@/components/notes/notes-workspace"

export const dynamic = "force-dynamic"

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

  const notes =
    noteDelegate && typeof noteDelegate.findMany === "function"
      ? await noteDelegate.findMany({
          where: { tenantId: session.tenantId },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
          take: 400,
        })
      : []

  const initialNotes = notes.map((note) => ({
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
  }))

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
