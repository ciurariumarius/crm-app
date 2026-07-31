export type NotesWorkspaceScope = "view" | "all"

export type WorkspaceScopedNote = {
  id: string
  archived: boolean
  deletedAt?: string | null
  sourceType?: "note" | "project" | "task"
}

function isPersonalNote(note: WorkspaceScopedNote) {
  if (note.sourceType) return note.sourceType === "note"
  return !note.id.startsWith("project:") && !note.id.startsWith("task:")
}

export function resolveNotesScope<T extends WorkspaceScopedNote>(
  allNotes: T[],
  currentViewNotes: T[],
  scope: NotesWorkspaceScope
) {
  if (scope === "view") return currentViewNotes
  return allNotes.filter(
    (note) => isPersonalNote(note) && !note.archived && !note.deletedAt
  )
}

export function enqueueSerializedNoteSave<T>(
  queues: Map<string, Promise<T>>,
  noteId: string,
  runSave: () => Promise<T>
) {
  const previous = queues.get(noteId)
  const nextSave = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(runSave)
  queues.set(noteId, nextSave)
  const cleanup = () => {
    if (queues.get(noteId) === nextSave) queues.delete(noteId)
  }
  void nextSave.then(cleanup, cleanup)
  return nextSave
}
