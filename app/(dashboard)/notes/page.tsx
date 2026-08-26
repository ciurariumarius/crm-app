import { requireAuth } from "@/lib/auth"
import { NotesWorkspace } from "@/components/notes/notes-workspace"
import { getNotesWorkspaceBootstrap, type NotesView } from "@/lib/notes/queries.server"

export const dynamic = "force-dynamic"

export default async function NotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ note?: string; view?: string; new?: string }>
}) {
  await requireAuth()
  const params = (await searchParams) || {}
  const requestedView: NotesView = params.view?.startsWith("folder:")
    ? params.view as NotesView
    : "all"
  const startNewNote = params.new === "1"
  const hasExplicitNote = Boolean(params.note)
  const bootstrap = await getNotesWorkspaceBootstrap({
    view: startNewNote ? "all" : requestedView,
    selectedNoteId: startNewNote ? null : params.note || null,
    skipSelectedNote: startNewNote || !hasExplicitNote,
  })

  return (
    <NotesWorkspace
      initialRows={bootstrap.rows}
      initialSelectedNote={startNewNote ? null : bootstrap.selectedNote}
      initialView={startNewNote ? "all" : requestedView}
      initialFolders={bootstrap.folders}
      initialNextCursor={bootstrap.nextCursor}
      initialTotalCount={bootstrap.totalCount}
      initialAllCount={bootstrap.allCount}
      requestedNoteId={params.note || null}
      startNewNote={startNewNote}
    />
  )
}
