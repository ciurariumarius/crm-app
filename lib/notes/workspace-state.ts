import { hasMeaningfulRichTextContent } from "@/lib/notes/content"

export type NotesWorkspaceScope = "view" | "all"

export type WorkspaceScopedNote = {
  id: string
  archived: boolean
  deletedAt?: string | null
  sourceType?: "note" | "project" | "task"
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

type ProjectNoteDraft = {
  content: string
  editedAt: number
  knownServerContents: string[]
}

const PROJECT_NOTE_DRAFT_PREFIX = "crm:project-note-draft:v2:"
const LEGACY_PROJECT_NOTE_DRAFT_PREFIX = "crm:project-note-draft:"
const PROJECT_NOTE_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const MAX_KNOWN_PROJECT_NOTE_VERSIONS = 4

function projectNoteDraftKey(projectId: string, prefix = PROJECT_NOTE_DRAFT_PREFIX) {
  return `${prefix}${projectId}`
}

function readProjectNoteDraftAtKey(storage: StorageLike, key: string) {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProjectNoteDraft>
    if (
      typeof parsed.content !== "string"
      || typeof parsed.editedAt !== "number"
      || !Array.isArray(parsed.knownServerContents)
      || !parsed.knownServerContents.every((value) => typeof value === "string")
    ) {
      storage.removeItem(key)
      return null
    }
    return parsed as ProjectNoteDraft
  } catch {
    return null
  }
}

function readProjectNoteDraft(storage: StorageLike, projectId: string) {
  return readProjectNoteDraftAtKey(storage, projectNoteDraftKey(projectId))
}

function writeProjectNoteDraftRecord(
  storage: StorageLike,
  projectId: string,
  draft: ProjectNoteDraft
) {
  try {
    storage.setItem(projectNoteDraftKey(projectId), JSON.stringify(draft))
  } catch {
    // Autosave remains the primary persistence path when browser storage is unavailable.
  }
}

function appendKnownProjectNoteContent(values: string[], content: string) {
  return [...values.filter((value) => value !== content), content]
    .slice(-MAX_KNOWN_PROJECT_NOTE_VERSIONS)
}

export function recordProjectNoteDraft(
  storage: StorageLike,
  projectId: string,
  content: string,
  knownServerContent: string,
  now = Date.now()
) {
  const existing = readProjectNoteDraft(storage, projectId)
  writeProjectNoteDraftRecord(storage, projectId, {
    content,
    editedAt: now,
    knownServerContents: appendKnownProjectNoteContent(
      existing?.knownServerContents ?? [],
      knownServerContent
    ),
  })
}

export function markProjectNoteDraftSaved(
  storage: StorageLike,
  projectId: string,
  savedContent: string
) {
  const existing = readProjectNoteDraft(storage, projectId)
  if (!existing) return
  writeProjectNoteDraftRecord(storage, projectId, {
    ...existing,
    knownServerContents: appendKnownProjectNoteContent(
      existing.knownServerContents,
      savedContent
    ),
  })
}

export function resolveProjectNoteDraftContent(
  storage: StorageLike,
  projectId: string,
  serverContent: string,
  now = Date.now()
) {
  let draft = readProjectNoteDraft(storage, projectId)
  if (!draft) {
    const legacyKey = projectNoteDraftKey(projectId, LEGACY_PROJECT_NOTE_DRAFT_PREFIX)
    const legacyDraft = readProjectNoteDraftAtKey(storage, legacyKey)
    storage.removeItem(legacyKey)
    if (legacyDraft && hasMeaningfulRichTextContent(legacyDraft.content)) {
      draft = legacyDraft
      writeProjectNoteDraftRecord(storage, projectId, legacyDraft)
    }
  }
  if (!draft) return null
  if (now - draft.editedAt > PROJECT_NOTE_DRAFT_MAX_AGE_MS) {
    storage.removeItem(projectNoteDraftKey(projectId))
    return null
  }
  if (draft.content === serverContent) {
    storage.removeItem(projectNoteDraftKey(projectId))
    return null
  }
  const serverVersionIsKnown = draft.knownServerContents.some(
    (knownContent) =>
      knownContent === serverContent
      || (
        !hasMeaningfulRichTextContent(knownContent)
        && !hasMeaningfulRichTextContent(serverContent)
      )
  )
  return serverVersionIsKnown ? draft.content : null
}

export function clearProjectNoteDraftIfContent(
  storage: StorageLike,
  projectId: string,
  savedContent: string
) {
  const draft = readProjectNoteDraft(storage, projectId)
  if (draft?.content === savedContent) {
    storage.removeItem(projectNoteDraftKey(projectId))
  }
}

export function isNoteDraftDirty(draftRevision: number, savedRevision: number) {
  return draftRevision > savedRevision
}

export function resolveNoteEditorDraft(
  noteId: string,
  activeEditorNoteId: string | null,
  activeDraft: string,
  storedDraft: string | undefined,
  serverContent: string
) {
  if (activeEditorNoteId === noteId) return activeDraft
  return storedDraft ?? serverContent
}

export function shouldAcceptNoteEditorChange(
  editorNoteId: string,
  selectedNoteId: string | null
) {
  return editorNoteId === selectedNoteId
}

export function shouldDiscardNewNote(isNewNote: boolean, content: string) {
  if (!isNewNote) return false
  return !content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, "")
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
