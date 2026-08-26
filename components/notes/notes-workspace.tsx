"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns"
import {
  ChevronDown,
  ChevronLeft,
  Folder,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Pin,
  Plus,
  Search,
  Share2,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  createNote,
  createNoteFolder,
  deleteNoteFolder,
  getNoteDetail,
  permanentlyDeleteNote,
  queryNoteList,
  renameNoteFolder,
  saveNoteContent,
  type NoteDetail,
  type NoteFolderRecord,
  type NoteListRow,
  type NotesView,
} from "@/lib/actions/notes"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { NotesSearchInput } from "@/components/notes/notes-search-input"
import type { RichTextFolderOption } from "@/components/ui/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ALL_NOTES_FOLDER_LABEL,
  readFolderMentionId,
  removeFolderMentions,
} from "@/lib/notes/folder-mentions"
import { hasMeaningfulRichTextContent, hasNoteContentStateChanged } from "@/lib/notes/content"
import { deriveNoteTitleFromContent, derivePreviewBodyFromContent } from "@/lib/notes/derived-note-text"
import { cn } from "@/lib/utils"
import { useResponsiveProfile } from "@/hooks/use-responsive-profile"
import {
  applyFolderCountChange,
  resolveNotesUrlNoteId,
  shouldApplyNotesRequest,
  NOTES_FOLDERS_MIN_WIDTH,
  NOTES_FOLDERS_MAX_WIDTH,
  NOTES_FOLDERS_DEFAULT_WIDTH,
  NOTES_LIST_MIN_WIDTH,
  NOTES_LIST_MAX_WIDTH,
  NOTES_LIST_DEFAULT_WIDTH,
  NOTES_FOLDERS_WIDTH_STORAGE_KEY,
  NOTES_LIST_WIDTH_STORAGE_KEY,
  parseStoredNotesPaneWidth,
} from "@/lib/notes/workspace-state"

const RichTextEditor = dynamic(
  () => import("@/components/ui/rich-text-editor").then((module) => module.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="h-full animate-pulse bg-[var(--surface-low)]/35" aria-label="Loading note editor" />,
  }
)

type ClientNoteRow = NoteListRow & {
  localOnly?: boolean
  hasLocalContent?: boolean
}

type ClientNoteDetail = NoteDetail & {
  localOnly?: boolean
}

type NotesWorkspaceProps = {
  initialRows: NoteListRow[]
  initialSelectedNote: NoteDetail | null
  initialView: NotesView
  initialFolders: NoteFolderRecord[]
  initialNextCursor: string | null
  initialTotalCount: number
  initialAllCount: number
  requestedNoteId?: string | null
  startNewNote?: boolean
}

type MobilePane = "folders" | "list" | "editor"
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict"
type NoteEditorSnapshot = {
  noteId: string
  content: string
  folderId: string | null
  revision: number
  persisted: boolean
  meaningful: boolean
}
type NoteEditorFlushResult = {
  ok: boolean
  persisted: boolean
}
type NoteEditorSessionHandle = {
  cancelPendingSaves: () => Promise<boolean>
  flushPendingSaves: () => Promise<NoteEditorFlushResult>
  getSnapshot: () => NoteEditorSnapshot
  moveToFolder: (folderId: string | null) => Promise<NoteEditorFlushResult>
}

function noteDraftKey(noteId: string) {
  return `notes.draft.${noteId}`
}

function removeStoredDraft(noteId: string) {
  try {
    window.localStorage.removeItem(noteDraftKey(noteId))
  } catch {
    // Autosave remains available when local recovery storage is unavailable.
  }
}

function storeRecoveryDraft(noteId: string, content: string, revision: number, folderId: string | null) {
  try {
    window.localStorage.setItem(
      noteDraftKey(noteId),
      JSON.stringify({ content, revision, folderId })
    )
    return true
  } catch {
    return false
  }
}

function rowFromDetail(note: NoteDetail): NoteListRow {
  return {
    id: note.id,
    folderId: note.folderId,
    title: note.title,
    preview: note.contentText.slice(0, 180),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

function sortRows(rows: ClientNoteRow[]) {
  return [...rows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

function folderView(folderId: string): NotesView {
  return `folder:${folderId}`
}

function folderIdFromView(view: NotesView) {
  return view.startsWith("folder:") ? view.slice("folder:".length) : null
}

function recoverDraft(note: ClientNoteDetail) {
  if (typeof window === "undefined") return note.content
  try {
    const raw = window.localStorage.getItem(noteDraftKey(note.id))
    if (!raw) return note.content
    const parsed = JSON.parse(raw) as { content?: string; revision?: number }
    return parsed.revision === note.contentRevision && typeof parsed.content === "string"
      ? parsed.content
      : note.content
  } catch {
    return note.content
  }
}

function hasMeaningfulNoteContent(content: string) {
  return hasMeaningfulRichTextContent(removeFolderMentions(content))
}

const NoteEditorSession = React.memo(React.forwardRef<NoteEditorSessionHandle, {
  note: ClientNoteDetail
  folders: NoteFolderRecord[]
  focusToken?: number
  isPinned: boolean
  onTogglePin: () => void
  onDuplicate: () => void
  onMoveToFolder: () => void
  onSaved: (note: NoteDetail) => void
  onCreated: (note: NoteDetail) => void
  onForkCreated: (note: NoteDetail) => void
  onMeaningfulDraft: (noteId: string) => void
  onLocalFolderChanged: (noteId: string, folderId: string | null) => void
  onBack: () => void
  onDelete: () => void
}>(function NoteEditorSession({
  note,
  folders,
  focusToken,
  isPinned,
  onTogglePin,
  onDuplicate,
  onMoveToFolder,
  onSaved,
  onCreated,
  onForkCreated,
  onMeaningfulDraft,
  onLocalFolderChanged,
  onBack,
  onDelete,
}, ref) {
  const [draft, setDraft] = React.useState(() => recoverDraft(note))
  const [folderId, setFolderId] = React.useState<string | null>(note.folderId)
  const [saveState, setSaveState] = React.useState<SaveState>("idle")
  const [externalUpdateToken, setExternalUpdateToken] = React.useState(0)
  const draftRef = React.useRef(draft)
  const folderIdRef = React.useRef(folderId)
  const savedContentRef = React.useRef(note.content)
  const savedFolderIdRef = React.useRef(note.folderId)
  const revisionRef = React.useRef(note.contentRevision)
  const persistedRef = React.useRef(!note.localOnly)
  const dirtyRef = React.useRef(false)
  const folderChipManagedRef = React.useRef(Boolean(readFolderMentionId(note.content)))
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const recoveryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = React.useRef<Promise<boolean>>(Promise.resolve(true))
  const meaningfulReportedRef = React.useRef(false)
  const cancelledRef = React.useRef(false)

  const folderOptions = React.useMemo<RichTextFolderOption[]>(
    () => [
      { id: null, name: ALL_NOTES_FOLDER_LABEL },
      ...folders.map((folder) => ({ id: folder.id, name: folder.name })),
    ],
    [folders]
  )

  const performSave = React.useCallback(async () => {
    if (cancelledRef.current) return false
    const content = draftRef.current
    if (!hasMeaningfulNoteContent(content) && !persistedRef.current) return true
    setSaveState("saving")

    if (!persistedRef.current) {
      const result = await createNote({
        id: note.id,
        content,
        folderId: folderIdRef.current,
      })
      if (!result.success) {
        setSaveState("error")
        return false
      }
      persistedRef.current = true
      revisionRef.current = result.data.contentRevision
      savedContentRef.current = result.data.content
      savedFolderIdRef.current = result.data.folderId
      dirtyRef.current = hasNoteContentStateChanged({
        savedContent: result.data.content,
        nextContent: draftRef.current,
        savedFolderId: result.data.folderId,
        nextFolderId: folderIdRef.current,
      })
      if (!dirtyRef.current) removeStoredDraft(note.id)
      setSaveState(dirtyRef.current ? "saving" : "saved")
      onCreated(result.data)
      return true
    }

    if (!dirtyRef.current) return true
    const result = await saveNoteContent({
      noteId: note.id,
      content,
      expectedRevision: revisionRef.current,
      folderId: folderIdRef.current,
    })
    if (!result.success) {
      setSaveState("code" in result && result.code === "NOTE_CONTENT_CONFLICT" ? "conflict" : "error")
      return false
    }
    revisionRef.current = result.data.contentRevision
    savedContentRef.current = result.data.content
    savedFolderIdRef.current = result.data.folderId
    dirtyRef.current = hasNoteContentStateChanged({
      savedContent: result.data.content,
      nextContent: draftRef.current,
      savedFolderId: result.data.folderId,
      nextFolderId: folderIdRef.current,
    })
    if (!dirtyRef.current) removeStoredDraft(note.id)
    setSaveState(dirtyRef.current ? "saving" : "saved")
    onSaved(result.data)
    return true
  }, [note.id, onCreated, onSaved])

  const enqueueSave = React.useCallback(() => {
    const next = saveQueueRef.current.then(performSave, performSave)
    saveQueueRef.current = next
    return next
  }, [performSave])

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void enqueueSave()
    }, 800)
  }, [enqueueSave])

  React.useEffect(() => {
    const persistDraftForPageExit = () => {
      if (!dirtyRef.current || cancelledRef.current) return
      storeRecoveryDraft(note.id, draftRef.current, revisionRef.current, folderIdRef.current)
    }
    window.addEventListener("pagehide", persistDraftForPageExit)
    return () => {
      window.removeEventListener("pagehide", persistDraftForPageExit)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
      if (dirtyRef.current && !cancelledRef.current) void enqueueSave()
    }
  }, [enqueueSave, note.id])

  React.useImperativeHandle(ref, () => ({
    cancelPendingSaves: async () => {
      cancelledRef.current = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
      await saveQueueRef.current.catch(() => false)
      return persistedRef.current
    },
    flushPendingSaves: async () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      const ok = dirtyRef.current ? await enqueueSave() : await saveQueueRef.current.catch(() => false)
      return { ok, persisted: persistedRef.current }
    },
    getSnapshot: () => ({
      noteId: note.id,
      content: draftRef.current,
      folderId: folderIdRef.current,
      revision: revisionRef.current,
      persisted: persistedRef.current,
      meaningful: hasMeaningfulNoteContent(draftRef.current),
    }),
    moveToFolder: async (nextFolderId: string | null) => {
      if (nextFolderId === folderIdRef.current) {
        return { ok: true, persisted: persistedRef.current }
      }
      folderIdRef.current = nextFolderId
      setFolderId(nextFolderId)
      dirtyRef.current = hasNoteContentStateChanged({
        savedContent: savedContentRef.current,
        nextContent: draftRef.current,
        savedFolderId: savedFolderIdRef.current,
        nextFolderId,
      })
      if (!persistedRef.current && !hasMeaningfulNoteContent(draftRef.current)) {
        storeRecoveryDraft(note.id, draftRef.current, revisionRef.current, nextFolderId)
        onLocalFolderChanged(note.id, nextFolderId)
        return { ok: true, persisted: false }
      }
      const ok = await enqueueSave()
      return { ok, persisted: persistedRef.current }
    },
  }), [enqueueSave, note.id, onLocalFolderChanged])

  const handleChange = React.useCallback((content: string) => {
    if (content === draftRef.current) return
    draftRef.current = content
    setDraft(content)
    dirtyRef.current = hasNoteContentStateChanged({
      savedContent: savedContentRef.current,
      nextContent: content,
      savedFolderId: savedFolderIdRef.current,
      nextFolderId: folderIdRef.current,
    })
    setSaveState("idle")
    if (!meaningfulReportedRef.current && hasMeaningfulNoteContent(content)) {
      meaningfulReportedRef.current = true
      onMeaningfulDraft(note.id)
    }
    if (folderChipManagedRef.current) {
      const mentionedFolderId = readFolderMentionId(content)
      if (mentionedFolderId !== folderIdRef.current) {
        folderIdRef.current = mentionedFolderId
        setFolderId(mentionedFolderId)
      }
    }
    if (!dirtyRef.current) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
      removeStoredDraft(note.id)
      return
    }
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
    recoveryTimerRef.current = setTimeout(() => {
      storeRecoveryDraft(note.id, draftRef.current, revisionRef.current, folderIdRef.current)
    }, 250)
    scheduleSave()
  }, [note.id, onMeaningfulDraft, scheduleSave])

  const flushFolderChange = React.useCallback((nextFolderId: string | null, content: string) => {
    folderChipManagedRef.current = true
    folderIdRef.current = nextFolderId
    draftRef.current = content
    dirtyRef.current = true
    setFolderId(nextFolderId)
    setDraft(content)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    void enqueueSave()
  }, [enqueueSave])

  const reloadServerVersion = React.useCallback(async () => {
    const result = await getNoteDetail(note.id)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    draftRef.current = result.data.content
    folderIdRef.current = result.data.folderId
    revisionRef.current = result.data.contentRevision
    savedContentRef.current = result.data.content
    savedFolderIdRef.current = result.data.folderId
    dirtyRef.current = false
    folderChipManagedRef.current = Boolean(readFolderMentionId(result.data.content))
    setDraft(result.data.content)
    setFolderId(result.data.folderId)
    setExternalUpdateToken((token) => token + 1)
    setSaveState("saved")
    removeStoredDraft(note.id)
    onSaved(result.data)
  }, [note.id, onSaved])

  const keepAsNewNote = React.useCallback(async () => {
    const result = await createNote({
      id: crypto.randomUUID(),
      content: draftRef.current,
      folderId: folderIdRef.current,
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    onForkCreated(result.data)
  }, [onForkCreated])

  const keepMyDraft = React.useCallback(async () => {
    const result = await getNoteDetail(note.id)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    revisionRef.current = result.data.contentRevision
    dirtyRef.current = true
    setSaveState("idle")
    void enqueueSave()
  }, [note.id, enqueueSave])

  const shareNote = React.useCallback(async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: note.title || "Pixelist note", url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success("Note link copied to clipboard")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast.error("The note link could not be shared")
    }
  }, [note.title])

  const saveStatus = saveState === "saving" ? (
    <span role="status" aria-live="polite" className="text-xs font-medium text-[var(--text-muted)]">Saving…</span>
  ) : saveState === "error" || saveState === "conflict" ? (
    <span role="status" aria-live="assertive" className="text-xs font-medium text-red-500">
      {saveState === "error" ? "Save failed" : "Changed elsewhere"}
    </span>
  ) : saveState === "saved" ? (
    <span role="status" aria-live="polite" className="text-xs font-medium text-[var(--text-muted)]">Saved</span>
  ) : null

  const noteActions = (
    <>
      {saveState === "error" ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => void enqueueSave()} className="h-8 px-2 text-xs">Retry</Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onTogglePin}
        className={cn(
          "h-10 w-10 rounded-xl transition-colors md:h-8 md:w-8 md:rounded-lg",
          isPinned
            ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] hover:bg-[color:color-mix(in_srgb,var(--primary)_16%,transparent)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
        )}
        title={isPinned ? "Unpin note" : "Pin note"}
        aria-label={isPinned ? "Unpin note" : "Pin note"}
      >
        <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:h-8 md:w-8 md:rounded-lg"
            aria-label="Note actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => void shareNote()}>
            <Share2 className="mr-2 h-4 w-4" /> Share note
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMoveToFolder}>
            <Folder className="mr-2 h-4 w-4" /> Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <SquarePen className="mr-2 h-4 w-4" /> Duplicate note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-red-600 focus:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" /> Delete note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent" aria-label="Note editor">
      <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-[var(--line-subtle)] px-2 md:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--primary)_9%,transparent)]"
          aria-label="Back to notes list"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Notes</span>
        </button>
        <div className="flex min-w-0 items-center gap-0.5">
          <div className="max-w-24 truncate px-1">{saveStatus}</div>
          {noteActions}
        </div>
      </div>
      {saveState === "conflict" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line-subtle)] bg-[var(--state-danger-surface)] px-4 py-2 text-sm text-[var(--state-urgent)]">
          <span className="mr-auto">This note changed in another view. Your draft is preserved.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void reloadServerVersion()}>Reload server version</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void keepAsNewNote()}>Keep as new note</Button>
          <Button type="button" size="sm" onClick={() => void keepMyDraft()}>Keep my draft</Button>
        </div>
      ) : null}

      <div className="relative min-h-0 h-full flex-1 overflow-hidden notes-thin-scrollbar">
        <RichTextEditor
          value={draft}
          onChange={handleChange}
          onBlur={() => { if (dirtyRef.current) void enqueueSave() }}
          placeholder="Title"
          variant="plain"
          mode="document"
          panelStyle="borderless"
          documentLayout="left"
          documentWidth="full"
          documentHeader={
            <>
              <p className="truncate pb-1 pt-2 text-xs font-normal text-[var(--text-muted)] md:hidden">
                {format(new Date(note.updatedAt), "d MMMM yyyy 'at' HH:mm")}
              </p>
              <div className="hidden min-w-0 items-center justify-between gap-2 pb-1 pt-4 md:flex">
                <p className="min-w-0 truncate text-xs font-normal text-[var(--text-muted)]">
                  {format(new Date(note.updatedAt), "d MMMM yyyy 'at' HH:mm")}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {saveStatus}
                  {noteActions}
                </div>
              </div>
            </>
          }
          toolbarVisibility="always"
          toolbarPreset="minimal"
          toolbarTone="quiet"
          toolbarPinned
          notesMode
          notesAppearance="apple"
          focusToken={focusToken}
          uploadProjectId={`note-${note.id}`}
          imageUploadFallback="error"
          showImageGallery={false}
          folderOptions={folderOptions}
          onFolderMentionChange={flushFolderChange}
          externalUpdateToken={externalUpdateToken}
          className="h-full min-h-0"
          minHeightClassName="min-h-full overscroll-y-contain"
        />
      </div>
    </section>
  )
}))

type SortBy = "updatedAt" | "createdAt" | "title"

function groupNotesByDate(
  rows: ClientNoteRow[],
  pinnedIds: Set<string>,
  sortBy: SortBy = "updatedAt"
): Array<{ title: string; notes: ClientNoteRow[] }> {
  const compareRows = (a: ClientNoteRow, b: ClientNoteRow) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "")
    const key = sortBy === "createdAt" ? "createdAt" : "updatedAt"
    return new Date(b[key]).getTime() - new Date(a[key]).getTime()
  }
  const pinnedNotes = rows.filter((r) => pinnedIds.has(r.id)).sort(compareRows)
  const unpinnedNotes = rows.filter((r) => !pinnedIds.has(r.id))
  const sortedUnpinned = [...unpinnedNotes].sort(compareRows)

  const result: Array<{ title: string; notes: ClientNoteRow[] }> = []

  if (pinnedNotes.length > 0) {
    result.push({
      title: "PINNED",
      notes: pinnedNotes,
    })
  }

  if (sortBy === "title") {
    if (sortedUnpinned.length > 0) {
      result.push({
        title: "ALL NOTES",
        notes: sortedUnpinned,
      })
    }
    return result
  }

  const now = new Date()
  const groups: Record<string, ClientNoteRow[]> = {}
  const groupOrder: string[] = []

  for (const row of sortedUnpinned) {
    const date = new Date(sortBy === "createdAt" ? row.createdAt : row.updatedAt)
    let section = "PREVIOUS 30 DAYS"

    if (isToday(date)) {
      section = "TODAY"
    } else if (isYesterday(date)) {
      section = "YESTERDAY"
    } else if (differenceInCalendarDays(now, date) <= 7 && differenceInCalendarDays(now, date) >= 0) {
      section = "PREVIOUS 7 DAYS"
    } else if (differenceInCalendarDays(now, date) <= 30 && differenceInCalendarDays(now, date) >= 0) {
      section = "PREVIOUS 30 DAYS"
    } else if (date.getFullYear() === now.getFullYear()) {
      section = format(date, "MMMM").toUpperCase()
    } else {
      section = format(date, "yyyy")
    }

    if (!groups[section]) {
      groups[section] = []
      groupOrder.push(section)
    }
    groups[section].push(row)
  }

  for (const title of groupOrder) {
    result.push({
      title,
      notes: groups[title],
    })
  }

  return result
}

export function NotesWorkspace({
  initialRows,
  initialSelectedNote,
  initialView,
  initialFolders,
  initialNextCursor,
  initialTotalCount,
  initialAllCount,
  requestedNoteId = null,
  startNewNote = false,
}: NotesWorkspaceProps) {
  const responsiveProfile = useResponsiveProfile()
  const isMobile = responsiveProfile === "mobile"
  const [responsiveReady, setResponsiveReady] = React.useState(false)
  const [rows, setRows] = React.useState<ClientNoteRow[]>(initialRows)
  const [folders, setFolders] = React.useState(initialFolders)
  const [view, setView] = React.useState<NotesView>(initialView)
  const [search, setSearch] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(initialSelectedNote?.id ?? null)
  const [selectedNote, setSelectedNote] = React.useState<ClientNoteDetail | null>(initialSelectedNote)
  const [nextCursor, setNextCursor] = React.useState(initialNextCursor)
  const [totalCount, setTotalCount] = React.useState(initialTotalCount)
  const [allCount, setAllCount] = React.useState(initialAllCount)
  const [loadingList, setLoadingList] = React.useState(false)
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [focusToken, setFocusToken] = React.useState<number | undefined>(undefined)
  const [editorSessionVersion, setEditorSessionVersion] = React.useState(0)
  const [mobilePane, setMobilePane] = React.useState<MobilePane>(startNewNote || requestedNoteId ? "editor" : "list")
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false)
  const [mobileListOptionsOpen, setMobileListOptionsOpen] = React.useState(false)
  const mobileSearchRef = React.useRef<HTMLInputElement>(null)
  const desktopSearchRef = React.useRef<HTMLInputElement>(null)
  const [folderDialog, setFolderDialog] = React.useState<{ mode: "create" | "rename"; folder?: NoteFolderRecord } | null>(null)
  const [folderName, setFolderName] = React.useState("")
  const [folderToDelete, setFolderToDelete] = React.useState<NoteFolderRecord | null>(null)
  const [noteToDelete, setNoteToDelete] = React.useState<ClientNoteDetail | null>(null)
  const [noteToMove, setNoteToMove] = React.useState<ClientNoteDetail | null>(null)
  const [pendingAction, setPendingAction] = React.useState<string | null>(null)
  const pendingActionRef = React.useRef(false)
  const [sortBy, setSortBy] = React.useState<SortBy>("updatedAt")
  const [pinnedIds, setPinnedIds] = React.useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem("notes_pinned_ids")
      if (!raw) return new Set()
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed)
        ? new Set(parsed.filter((value): value is string => typeof value === "string"))
        : new Set()
    } catch {
      return new Set()
    }
  })

  const [foldersWidth, setFoldersWidth] = React.useState<number>(() => {
    if (typeof window === "undefined") return NOTES_FOLDERS_DEFAULT_WIDTH
    try {
      return parseStoredNotesPaneWidth(
        localStorage.getItem(NOTES_FOLDERS_WIDTH_STORAGE_KEY),
        NOTES_FOLDERS_MIN_WIDTH,
        NOTES_FOLDERS_MAX_WIDTH,
        NOTES_FOLDERS_DEFAULT_WIDTH
      )
    } catch {
      return NOTES_FOLDERS_DEFAULT_WIDTH
    }
  })

  const [listWidth, setListWidth] = React.useState<number>(() => {
    if (typeof window === "undefined") return NOTES_LIST_DEFAULT_WIDTH
    try {
      return parseStoredNotesPaneWidth(
        localStorage.getItem(NOTES_LIST_WIDTH_STORAGE_KEY),
        NOTES_LIST_MIN_WIDTH,
        NOTES_LIST_MAX_WIDTH,
        NOTES_LIST_DEFAULT_WIDTH
      )
    } catch {
      return NOTES_LIST_DEFAULT_WIDTH
    }
  })

  const foldersWidthRef = React.useRef(foldersWidth)
  const listWidthRef = React.useRef(listWidth)
  foldersWidthRef.current = foldersWidth
  listWidthRef.current = listWidth

  const [isResizingFolders, setIsResizingFolders] = React.useState(false)
  const [isResizingList, setIsResizingList] = React.useState(false)

  const handleFoldersResizeStart = React.useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsResizingFolders(true)
    const startX = e.clientX
    const startWidth = foldersWidthRef.current

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.max(
        NOTES_FOLDERS_MIN_WIDTH,
        Math.min(NOTES_FOLDERS_MAX_WIDTH, Math.round(startWidth + delta))
      )
      foldersWidthRef.current = nextWidth
      setFoldersWidth(nextWidth)
    }

    const handlePointerUp = () => {
      setIsResizingFolders(false)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      try {
        localStorage.setItem(NOTES_FOLDERS_WIDTH_STORAGE_KEY, String(foldersWidthRef.current))
      } catch {}
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }, [])

  const handleListResizeStart = React.useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsResizingList(true)
    const startX = e.clientX
    const startWidth = listWidthRef.current

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.max(
        NOTES_LIST_MIN_WIDTH,
        Math.min(NOTES_LIST_MAX_WIDTH, Math.round(startWidth + delta))
      )
      listWidthRef.current = nextWidth
      setListWidth(nextWidth)
    }

    const handlePointerUp = () => {
      setIsResizingList(false)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      try {
        localStorage.setItem(NOTES_LIST_WIDTH_STORAGE_KEY, String(listWidthRef.current))
      } catch {}
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }, [])

  React.useEffect(() => setResponsiveReady(true), [])

  const togglePin = React.useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem("notes_pinned_ids", JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [])
  const detailCacheRef = React.useRef(new Map<string, NoteDetail>())
  const rowsRef = React.useRef<ClientNoteRow[]>(initialRows)
  const selectedIdRef = React.useRef<string | null>(initialSelectedNote?.id ?? null)
  const selectedNoteRef = React.useRef<ClientNoteDetail | null>(initialSelectedNote)
  const mobilePaneRef = React.useRef<MobilePane>(mobilePane)
  const listRequestRef = React.useRef(0)
  const detailRequestRef = React.useRef(0)
  const initialQueryRef = React.useRef(true)
  const startNewHandledRef = React.useRef(false)
  const recoveredDraftHandledRef = React.useRef(false)
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)
  const editorSessionRef = React.useRef<NoteEditorSessionHandle | null>(null)
  const detailPrefetchesRef = React.useRef(new Map<string, Promise<void>>())
  const selectedRowButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const activeFolderButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const restoreFocusPaneRef = React.useRef<MobilePane | null>(null)

  const commitRows = React.useCallback((update: (current: ClientNoteRow[]) => ClientNoteRow[]) => {
    setRows((current) => {
      const next = update(current)
      rowsRef.current = next
      return next
    })
  }, [])

  const runExclusiveAction = React.useCallback(async (name: string, action: () => Promise<void>) => {
    if (pendingActionRef.current) return
    pendingActionRef.current = true
    setPendingAction(name)
    try {
      await action()
    } finally {
      pendingActionRef.current = false
      setPendingAction(null)
    }
  }, [])

  React.useEffect(() => {
    if (initialSelectedNote) detailCacheRef.current.set(initialSelectedNote.id, initialSelectedNote)
  }, [initialSelectedNote])

  React.useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  React.useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  React.useEffect(() => {
    selectedNoteRef.current = selectedNote
  }, [selectedNote])

  React.useEffect(() => {
    mobilePaneRef.current = mobilePane
  }, [mobilePane])

  const navigateMobilePane = React.useCallback((nextPane: MobilePane, replace = false) => {
    if (mobilePaneRef.current === nextPane) return
    mobilePaneRef.current = nextPane
    setMobilePane(nextPane)
    if (!window.matchMedia("(max-width: 767px)").matches) return
    const currentState = (window.history.state ?? {}) as Record<string, unknown>
    const currentDepth = typeof currentState.notesDepth === "number" ? currentState.notesDepth : 0
    const nextState = {
      ...currentState,
      notesPane: nextPane,
      notesDepth: replace ? currentDepth : currentDepth + 1,
    }
    const url = new URL(window.location.href)
    if (nextPane === "editor" && selectedIdRef.current) url.searchParams.set("note", selectedIdRef.current)
    else url.searchParams.delete("note")
    window.history[replace ? "replaceState" : "pushState"](nextState, "", `${url.pathname}${url.search}`)
  }, [])

  const returnToMobilePane = React.useCallback((fallbackPane: MobilePane) => {
    restoreFocusPaneRef.current = fallbackPane
    const currentState = (window.history.state ?? {}) as Record<string, unknown>
    const currentDepth = typeof currentState.notesDepth === "number" ? currentState.notesDepth : 0
    if (window.matchMedia("(max-width: 767px)").matches && currentDepth > 0) {
      window.history.back()
      return
    }
    navigateMobilePane(fallbackPane, true)
    window.setTimeout(() => {
      if (fallbackPane === "list") selectedRowButtonRef.current?.focus()
      if (fallbackPane === "folders") activeFolderButtonRef.current?.focus()
      restoreFocusPaneRef.current = null
    }, 0)
  }, [navigateMobilePane])

  React.useEffect(() => {
    const currentState = (window.history.state ?? {}) as Record<string, unknown>
    window.history.replaceState({
      ...currentState,
      notesPane: mobilePaneRef.current,
      notesDepth: typeof currentState.notesDepth === "number" ? currentState.notesDepth : 0,
    }, "", window.location.href)

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { notesPane?: MobilePane } | null
      if (state?.notesPane && ["folders", "list", "editor"].includes(state.notesPane)) {
        mobilePaneRef.current = state.notesPane
        setMobilePane(state.notesPane)
        setMobileSearchOpen(false)
        const focusPane = restoreFocusPaneRef.current
        if (focusPane === state.notesPane) {
          window.setTimeout(() => {
            if (focusPane === "list") selectedRowButtonRef.current?.focus()
            if (focusPane === "folders") activeFolderButtonRef.current?.focus()
            restoreFocusPaneRef.current = null
          }, 0)
        }
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const cacheDetail = React.useCallback((note: NoteDetail) => {
    const cache = detailCacheRef.current
    cache.delete(note.id)
    cache.set(note.id, note)
    while (cache.size > 10) {
      const oldest = cache.keys().next().value as string | undefined
      if (!oldest) break
      cache.delete(oldest)
    }
  }, [])

  const discardBlankLocalNote = React.useCallback((noteId: string | null) => {
    if (!noteId) return
    const row = rowsRef.current.find((item) => item.id === noteId)
    if (!row?.localOnly || row.hasLocalContent) return
    commitRows((current) => current.filter((item) => item.id !== noteId))
    setAllCount((count) => Math.max(0, count - 1))
    if (row.folderId) {
      setFolders((current) => current.map((folder) => folder.id === row.folderId ? { ...folder, count: Math.max(0, folder.count - 1) } : folder))
    }
    removeStoredDraft(noteId)
    detailCacheRef.current.delete(noteId)
  }, [commitRows])

  const selectNote = React.useCallback(async (noteId: string, shouldSwitchMobilePane = true) => {
    if (selectedIdRef.current !== noteId) discardBlankLocalNote(selectedIdRef.current)
    selectedIdRef.current = noteId
    setSelectedId(noteId)
    if (shouldSwitchMobilePane) {
      setMobileSearchOpen(false)
      navigateMobilePane("editor")
    }
    const cached = detailCacheRef.current.get(noteId)
    if (cached) {
      setSelectedNote(cached)
    }
    const currentSelected = selectedNoteRef.current
    const local = currentSelected?.id === noteId && currentSelected.localOnly ? currentSelected : null
    if (local) return
    const request = ++detailRequestRef.current
    setLoadingDetail(!cached)
    try {
      const result = await getNoteDetail(noteId)
      if (!shouldApplyNotesRequest(request, detailRequestRef.current)) return
      if (!result.success) {
        toast.error(result.error)
        return
      }
      cacheDetail(result.data)
      if (selectedIdRef.current === noteId) setSelectedNote(result.data)
    } finally {
      if (shouldApplyNotesRequest(request, detailRequestRef.current)) {
        setLoadingDetail(false)
      }
    }
  }, [cacheDetail, discardBlankLocalNote, navigateMobilePane])

  const prefetchNote = React.useCallback((noteId: string) => {
    if (detailCacheRef.current.has(noteId) || detailPrefetchesRef.current.has(noteId)) return
    const request = getNoteDetail(noteId).then((result) => {
      if (result.success) cacheDetail(result.data)
    }).finally(() => {
      detailPrefetchesRef.current.delete(noteId)
    })
    detailPrefetchesRef.current.set(noteId, request)
  }, [cacheDetail])

  React.useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches || selectedIdRef.current || !rowsRef.current[0]) return
    void selectNote(rowsRef.current[0].id, false)
  }, [responsiveProfile, selectNote])

  const beginNewNote = React.useCallback(() => {
    discardBlankLocalNote(selectedId)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const selectedFolderId = folderIdFromView(view)
    const detail: ClientNoteDetail = {
      id,
      folderId: selectedFolderId,
      title: "New note",
      preview: "",
      content: "",
      contentText: "",
      contentRevision: 0,
      hasChecklist: false,
      hasAttachment: false,
      createdAt: now,
      updatedAt: now,
      localOnly: true,
    }
    commitRows((current) => [{ ...rowFromDetail(detail), localOnly: true }, ...current])
    setAllCount((count) => count + 1)
    if (selectedFolderId) {
      setFolders((current) => current.map((folder) => folder.id === selectedFolderId ? { ...folder, count: folder.count + 1 } : folder))
    }
    selectedIdRef.current = id
    selectedNoteRef.current = detail
    setSelectedId(id)
    setSelectedNote(detail)
    setMobileSearchOpen(false)
    navigateMobilePane("editor")
    setFocusToken((token) => (token ?? 0) + 1)
  }, [commitRows, discardBlankLocalNote, navigateMobilePane, selectedId, view])

  React.useEffect(() => {
    if (recoveredDraftHandledRef.current || startNewNote || !requestedNoteId) return
    recoveredDraftHandledRef.current = true
    if (initialRows.some((row) => row.id === requestedNoteId)) return
    try {
      const raw = window.localStorage.getItem(noteDraftKey(requestedNoteId))
      if (!raw) return
      const recovered = JSON.parse(raw) as { content?: string; revision?: number; folderId?: string | null }
      if (recovered.revision !== 0 || typeof recovered.content !== "string" || !hasMeaningfulNoteContent(recovered.content)) return
      const folderId = folders.some((folder) => folder.id === recovered.folderId) ? recovered.folderId ?? null : null
      const now = new Date().toISOString()
      const detail: ClientNoteDetail = {
        id: requestedNoteId,
        folderId,
        title: deriveNoteTitleFromContent(recovered.content),
        preview: derivePreviewBodyFromContent(recovered.content, ""),
        content: recovered.content,
        contentText: recovered.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
        contentRevision: 0,
        hasChecklist: /data-type=["']taskList["']/i.test(recovered.content),
        hasAttachment: /<img\b/i.test(recovered.content),
        createdAt: now,
        updatedAt: now,
        localOnly: true,
      }
      selectedIdRef.current = requestedNoteId
      selectedNoteRef.current = detail
      commitRows((current) => [{ ...rowFromDetail(detail), localOnly: true, hasLocalContent: true }, ...current])
      setAllCount((count) => count + 1)
      if (folderId) setFolders((current) => current.map((folder) => folder.id === folderId ? { ...folder, count: folder.count + 1 } : folder))
      setSelectedId(requestedNoteId)
      setSelectedNote(detail)
      setMobilePane("editor")
    } catch {
      // Ignore malformed recovery data.
    }
  }, [commitRows, folders, initialRows, requestedNoteId, startNewNote])

  React.useEffect(() => {
    if (!startNewNote || startNewHandledRef.current) return
    startNewHandledRef.current = true
    beginNewNote()
  }, [beginNewNote, startNewNote])

  React.useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("view", view)
    const mobile = window.matchMedia("(max-width: 767px)").matches
    const urlNoteId = resolveNotesUrlNoteId({ isMobile: mobile, pane: mobilePane, selectedNoteId: selectedId })
    if (urlNoteId) url.searchParams.set("note", urlNoteId)
    else url.searchParams.delete("note")
    url.searchParams.delete("new")
    window.history.replaceState({
      ...(window.history.state ?? {}),
      notesPane: mobilePaneRef.current,
    }, "", `${url.pathname}${url.search}`)
  }, [mobilePane, selectedId, view])

  const replaceList = React.useCallback(async (nextView: NotesView, query: string) => {
    const request = ++listRequestRef.current
    setLoadingList(true)
    try {
      const result = await queryNoteList({ view: nextView, q: query, pageSize: 50 })
      if (!shouldApplyNotesRequest(request, listRequestRef.current)) return
      if (!result.success) {
        toast.error(result.error)
        return
      }
      commitRows(() => result.data.rows)
      setNextCursor(result.data.nextCursor)
      setTotalCount(result.data.totalCount)
      if (!query && nextView === "all") setAllCount(result.data.totalCount)
      const first = result.data.rows[0]
      if (first && !result.data.rows.some((row) => row.id === selectedIdRef.current)) {
        void selectNote(first.id, false)
      } else if (!first) {
        selectedIdRef.current = null
        selectedNoteRef.current = null
        setSelectedId(null)
        setSelectedNote(null)
        setMobilePane("list")
      }
    } finally {
      if (shouldApplyNotesRequest(request, listRequestRef.current)) {
        setLoadingList(false)
      }
    }
  }, [commitRows, selectNote])

  const switchView = React.useCallback((nextView: NotesView) => {
    if (view === nextView) {
      navigateMobilePane("list")
      return
    }
    const targetFolderId = folderIdFromView(nextView)
    // Instantly filter out notes from other folders so no old notes flash under the new folder
    commitRows((current) => {
      if (nextView === "all") return current
      if (!targetFolderId) return []
      return current.filter((row) => row.folderId === targetFolderId)
    })
    previousViewRef.current = nextView
    setView(nextView)
    setMobileSearchOpen(false)
    navigateMobilePane("list")
    void replaceList(nextView, search)
  }, [commitRows, navigateMobilePane, replaceList, search, view])

  const previousViewRef = React.useRef(view)
  const previousSearchRef = React.useRef(search)

  React.useEffect(() => {
    if (initialQueryRef.current) {
      initialQueryRef.current = false
      return
    }
    const viewChanged = previousViewRef.current !== view
    const searchChanged = previousSearchRef.current !== search
    previousViewRef.current = view
    previousSearchRef.current = search

    if (viewChanged) {
      void replaceList(view, search)
      return
    }
    if (searchChanged) {
      const timer = setTimeout(() => void replaceList(view, search), 200)
      return () => clearTimeout(timer)
    }
  }, [replaceList, search, view])

  const loadMore = React.useCallback(async () => {
    if (!nextCursor || loadingList) return
    const request = ++listRequestRef.current
    setLoadingList(true)
    try {
      const result = await queryNoteList({ view, q: search, cursor: nextCursor, pageSize: 50 })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (!shouldApplyNotesRequest(request, listRequestRef.current)) return
      commitRows((current) => {
        const known = new Set(current.map((row) => row.id))
        return [...current, ...result.data.rows.filter((row) => !known.has(row.id))]
      })
      setNextCursor(result.data.nextCursor)
    } finally {
      if (shouldApplyNotesRequest(request, listRequestRef.current)) setLoadingList(false)
    }
  }, [commitRows, loadingList, nextCursor, search, view])

  React.useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !nextCursor) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    }, { rootMargin: "240px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [loadMore, nextCursor])

  const applySavedNote = React.useCallback((note: NoteDetail) => {
    cacheDetail(note)
    if (selectedIdRef.current === note.id) {
      selectedNoteRef.current = note
      setSelectedNote(note)
    }
    const previous = rowsRef.current.find((row) => row.id === note.id)
    if (!previous) {
      setAllCount((count) => count + 1)
    }
    if ((!previous || previous.localOnly) && !search && (view === "all" || folderIdFromView(view) === note.folderId)) {
      setTotalCount((count) => count + 1)
    }
    if (previous?.folderId !== note.folderId) {
      setFolders((currentFolders) => applyFolderCountChange(currentFolders, previous?.folderId, note.folderId))
    }
    commitRows((current) => sortRows([{ ...rowFromDetail(note) }, ...current.filter((row) => row.id !== note.id)]))
  }, [cacheDetail, commitRows, search, view])

  const applyLocalFolderChange = React.useCallback((noteId: string, nextFolderId: string | null) => {
    const previous = rowsRef.current.find((row) => row.id === noteId)
    if (!previous || previous.folderId === nextFolderId) return
    setFolders((currentFolders) => applyFolderCountChange(currentFolders, previous.folderId, nextFolderId))
    commitRows((current) => current.map((row) => row.id === noteId ? { ...row, folderId: nextFolderId } : row))
    if (selectedNoteRef.current?.id === noteId) {
      const next = { ...selectedNoteRef.current, folderId: nextFolderId }
      selectedNoteRef.current = next
      setSelectedNote(next)
    }
  }, [commitRows])

  const duplicateCurrentNote = React.useCallback(async () => {
    await runExclusiveAction("duplicate", async () => {
    const flush = await editorSessionRef.current?.flushPendingSaves()
    if (flush && !flush.ok) {
      toast.error("Save the current note before duplicating it.")
      return
    }
    const snapshot = editorSessionRef.current?.getSnapshot()
    const current = selectedNoteRef.current
    if (!current || !snapshot?.meaningful) {
      toast.error("Write something before duplicating this note.")
      return
    }
    const id = crypto.randomUUID()
    const result = await createNote({
      id,
      content: snapshot.content,
      folderId: snapshot.folderId,
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success("Note duplicated")
    applySavedNote(result.data)
    setSelectedId(result.data.id)
    setSelectedNote(result.data)
    setFocusToken((token) => (token ?? 0) + 1)
    })
  }, [applySavedNote, runExclusiveAction])

  const moveNoteToFolder = React.useCallback(async (targetFolderId: string | null) => {
    if (!noteToMove) return
    await runExclusiveAction("move", async () => {
    const result = await editorSessionRef.current?.moveToFolder(targetFolderId)
    if (!result?.ok) {
      toast.error("The note could not be moved. Try saving it again.")
      return
    }
    toast.success("Note moved")
    setNoteToMove(null)
    })
  }, [noteToMove, runExclusiveAction])

  const createOrRenameFolder = React.useCallback(async () => {
    if (!folderDialog || !folderName.trim()) return
    await runExclusiveAction("folder", async () => {
    if (folderDialog.mode === "rename" && selectedNote?.localOnly && selectedNote.folderId === folderDialog.folder?.id) {
      toast.error("Write and save the new note before renaming its folder.")
      return
    }
    if (folderDialog.mode === "rename" && selectedNote?.folderId === folderDialog.folder?.id) {
      const flushed = await editorSessionRef.current?.flushPendingSaves()
      if (flushed && !flushed.ok) {
        toast.error("Save the current note before renaming its folder.")
        return
      }
    }
    const result = folderDialog.mode === "create"
      ? await createNoteFolder({ name: folderName })
      : await renameNoteFolder(folderDialog.folder!.id, { name: folderName })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setFolders((current) => folderDialog.mode === "create"
      ? [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))
      : current.map((folder) => folder.id === result.data.id ? result.data : folder))
    if (folderDialog.mode === "rename") {
      for (const [noteId, cached] of detailCacheRef.current) {
        if (cached.folderId === result.data.id) detailCacheRef.current.delete(noteId)
      }
    }
    setFolderDialog(null)
    setFolderName("")
    if (selectedNote?.folderId === result.data.id) {
      const refreshed = await getNoteDetail(selectedNote.id)
      if (refreshed.success) {
        applySavedNote(refreshed.data)
        setEditorSessionVersion((version) => version + 1)
      }
    }
    })
  }, [applySavedNote, folderDialog, folderName, runExclusiveAction, selectedNote])

  const confirmDeleteFolder = React.useCallback(async () => {
    if (!folderToDelete) return
    await runExclusiveAction("delete-folder", async () => {
    if (selectedNote?.localOnly && selectedNote.folderId === folderToDelete.id) {
      toast.error("Write and save the new note before deleting its folder.")
      return
    }
    if (selectedNote?.folderId === folderToDelete.id) {
      const flushed = await editorSessionRef.current?.flushPendingSaves()
      if (flushed && !flushed.ok) {
        toast.error("Save the current note before deleting its folder.")
        return
      }
    }
    const result = await deleteNoteFolder(folderToDelete.id)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setFolders((current) => current.filter((folder) => folder.id !== folderToDelete.id))
    for (const [noteId, cached] of detailCacheRef.current) {
      if (cached.folderId === folderToDelete.id) detailCacheRef.current.delete(noteId)
    }
    commitRows((current) => current.map((row) => row.folderId === folderToDelete.id ? { ...row, folderId: null } : row))
    if (view === folderView(folderToDelete.id)) setView("all")
    if (selectedNote?.folderId === folderToDelete.id) {
      const refreshed = await getNoteDetail(selectedNote.id)
      if (refreshed.success) {
        applySavedNote(refreshed.data)
        setEditorSessionVersion((version) => version + 1)
      }
    }
    setFolderToDelete(null)
    })
  }, [applySavedNote, commitRows, folderToDelete, runExclusiveAction, selectedNote, view])

  const confirmDeleteNote = React.useCallback(async () => {
    if (!noteToDelete) return
    await runExclusiveAction("delete-note", async () => {
    const persisted = await editorSessionRef.current?.cancelPendingSaves()
      ?? !noteToDelete.localOnly
    if (persisted) {
      const result = await permanentlyDeleteNote(noteToDelete.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
    }
    toast.success("Note deleted")
    commitRows((rows) => rows.filter((r) => r.id !== noteToDelete.id))
    if (!noteToDelete.localOnly) setTotalCount((c) => Math.max(0, c - 1))
    setAllCount((c) => Math.max(0, c - 1))
    if (noteToDelete.folderId) {
      setFolders((current) => applyFolderCountChange(current, noteToDelete.folderId, null))
    }
    setPinnedIds((current) => {
      if (!current.has(noteToDelete.id)) return current
      const nextPinned = new Set(current)
      nextPinned.delete(noteToDelete.id)
      try { localStorage.setItem("notes_pinned_ids", JSON.stringify(Array.from(nextPinned))) } catch {}
      return nextPinned
    })
    detailCacheRef.current.delete(noteToDelete.id)
    removeStoredDraft(noteToDelete.id)
    const next = rows.find((row) => row.id !== noteToDelete.id)
    setNoteToDelete(null)
    if (next) void selectNote(next.id)
    else {
      setSelectedId(null)
      setSelectedNote(null)
      setMobilePane("list")
    }
    })
  }, [commitRows, noteToDelete, rows, runExclusiveAction, selectNote])

  const mobileSearchInput = (
    <NotesSearchInput
      ref={mobileSearchRef}
      value={search}
      onChange={setSearch}
      showShortcutHint={false}
    />
  )
  const desktopSearchInput = (
    <NotesSearchInput
      ref={desktopSearchRef}
      value={search}
      onChange={setSearch}
      showShortcutHint={true}
    />
  )
  const addButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={beginNewNote}
      className="h-10 w-10 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:h-8 md:w-8 md:rounded-lg"
      title="New Note"
      aria-label="New note"
    >
      <SquarePen className="h-4 w-4" />
    </Button>
  )

  const activeFolderId = folderIdFromView(view)
  const folderNameById = React.useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders]
  )
  const visibleCount = search ? totalCount : view === "all" ? allCount : folders.find((folder) => folder.id === activeFolderId)?.count ?? totalCount
  const noteGroups = React.useMemo(() => groupNotesByDate(rows, pinnedIds, sortBy), [rows, pinnedIds, sortBy])
  const activeFolderName = activeFolderId ? folderNameById.get(activeFolderId) ?? "All Notes" : "All Notes"
  const shouldRenderEditor = mobilePane === "editor" || (responsiveReady && !isMobile)

  const toggleMobileSearch = React.useCallback(() => {
    const nextOpen = !mobileSearchOpen
    if (nextOpen && mobilePaneRef.current !== "list") {
      navigateMobilePane("list")
    }
    setMobileSearchOpen(nextOpen)
    if (nextOpen) setTimeout(() => mobileSearchRef.current?.focus(), 50)
  }, [mobileSearchOpen, navigateMobilePane])

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return
      event.preventDefault()
      if (window.matchMedia("(max-width: 767px)").matches) {
        if (mobilePaneRef.current !== "list") navigateMobilePane("list")
        setMobileSearchOpen(true)
        window.setTimeout(() => mobileSearchRef.current?.focus(), 50)
        return
      }
      desktopSearchRef.current?.focus()
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [navigateMobilePane])

  return (
    <div data-slot="notes-workspace" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-[var(--line-subtle)] bg-transparent px-4 py-2 md:hidden">
        <div className="flex items-center gap-3">
          <MobileMenuTrigger />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Notes</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={toggleMobileSearch} className="h-10 w-10 rounded-xl text-[var(--text-secondary)]" aria-label={mobileSearchOpen ? "Close search" : "Search notes"}>
            {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
          {addButton}
        </div>
      </header>
      {mobileSearchOpen ? (
        <div className="shrink-0 border-b border-[var(--line-subtle)] bg-transparent px-4 py-2 md:hidden">
          {mobileSearchInput}
        </div>
      ) : null}

      <div
        className="grid h-full min-h-0 flex-1 overflow-hidden md:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[180px_230px_minmax(0,1fr)]"
        style={{
          gridTemplateColumns: responsiveReady && !isMobile
            ? (responsiveProfile === "desktop"
                ? `${foldersWidth}px ${listWidth}px minmax(0, 1fr)`
                : `${listWidth}px minmax(0, 1fr)`)
            : undefined,
        }}
      >
        {/* Column 1: Folders Sidebar */}
        <aside
          data-slot="notes-folders"
          className={cn(
            "relative h-full min-h-0 flex-col overflow-hidden bg-transparent xl:border-r xl:border-[var(--line-subtle)]",
            mobilePane === "folders" ? "flex" : "hidden",
            "md:hidden xl:flex"
          )}
        >
          <div className="hidden md:flex flex-col gap-3 px-3 pt-5 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Notes</h1>
              {addButton}
            </div>
            {desktopSearchInput}
          </div>

          <div className="mt-0 flex min-h-12 shrink-0 items-center justify-between border-b border-[var(--line-subtle)] px-3 py-1 md:mt-1 md:min-h-0 md:border-b-0 md:py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">FOLDERS</span>
            <button
              type="button"
              ref={view === "all" ? activeFolderButtonRef : undefined}
              onClick={() => { setFolderDialog({ mode: "create" }); setFolderName("") }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:h-6 md:w-6 md:rounded-md"
              aria-label="Add folder"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <nav className="min-h-0 flex-1 overscroll-y-contain overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 space-y-0.5 flex flex-col notes-thin-scrollbar xl:pb-1" aria-label="Note folders">
            <button
              type="button"
              onClick={() => switchView("all")}
              aria-current={view === "all" ? "page" : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors md:min-h-8.5 md:rounded-lg",
                view === "all"
                  ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] font-semibold shadow-none"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)] font-normal"
              )}
            >
              <Folder className={cn("h-4 w-4 shrink-0", view === "all" ? "text-[var(--primary)]" : "text-[var(--text-muted)]")} />
              <span className="min-w-0 flex-1 truncate text-left">All Notes</span>
              <span className={cn("shrink-0 text-xs tabular-nums", view === "all" ? "text-[var(--primary)] font-semibold" : "text-[var(--text-muted)]")}>{allCount}</span>
            </button>
            {folders.map((folder) => {
              const isActive = activeFolderId === folder.id
              return (
                <div
                  key={folder.id}
                  className={cn(
                    "group relative flex min-h-11 items-center rounded-xl transition-colors md:min-h-8.5 md:rounded-lg",
                    isActive ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] font-semibold" : "hover:bg-[var(--surface-low)] font-normal text-[var(--text-secondary)]"
                  )}
                >
                  <button
                    type="button"
                    ref={isActive ? activeFolderButtonRef : undefined}
                    onClick={() => switchView(folderView(folder.id))}
                    aria-current={isActive ? "page" : undefined}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl py-2 pl-3 pr-2 text-left text-sm md:min-h-0 md:rounded-lg"
                  >
                    <Folder className={cn("h-4 w-4 shrink-0", isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]")} />
                    <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
                    <span className={cn("shrink-0 text-xs tabular-nums", isActive ? "text-[var(--primary)] font-semibold" : "text-[var(--text-muted)]")}>
                      {folder.count}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center pr-1 md:absolute md:right-1 md:top-1/2 md:-translate-y-1/2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-opacity hover:bg-[var(--surface-highest)] hover:text-[var(--text-primary)] focus-visible:opacity-100 data-[state=open]:opacity-100 md:h-6 md:w-6 md:rounded-md md:opacity-0 md:group-hover:opacity-100"
                          aria-label={`${folder.name} actions`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setFolderDialog({ mode: "rename", folder }); setFolderName(folder.name) }}>Rename</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setFolderToDelete(folder)}>Delete folder</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
            
          </nav>

          {/* Folders Resize Handle (Desktop only) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize folders sidebar"
            title="Drag to resize folders (double-click to reset)"
            onPointerDown={handleFoldersResizeStart}
            onDoubleClick={() => {
              setFoldersWidth(NOTES_FOLDERS_DEFAULT_WIDTH)
              foldersWidthRef.current = NOTES_FOLDERS_DEFAULT_WIDTH
              try {
                localStorage.setItem(NOTES_FOLDERS_WIDTH_STORAGE_KEY, String(NOTES_FOLDERS_DEFAULT_WIDTH))
              } catch {}
            }}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-2.5 -mr-1 z-30 cursor-col-resize select-none touch-none",
              "hidden xl:flex items-center justify-center hover:bg-[color:color-mix(in_srgb,var(--primary)_20%,transparent)] transition-colors group/resizer",
              isResizingFolders && "bg-[color:color-mix(in_srgb,var(--primary)_30%,transparent)]"
            )}
          >
            <div
              className={cn(
                "w-0.5 h-7 rounded-full bg-transparent group-hover/resizer:bg-[var(--primary)] transition-colors",
                isResizingFolders && "bg-[var(--primary)]"
              )}
            />
          </div>
        </aside>

        {/* Column 2: Notes List */}
        <section
          data-slot="notes-list"
          className={cn(
            "relative h-full min-h-0 flex-col overflow-hidden bg-transparent md:border-r md:border-[var(--line-subtle)]",
            mobilePane === "list" ? "flex" : "hidden",
            "md:flex"
          )}
          aria-label="Notes list"
        >
          <div className="hidden shrink-0 flex-col gap-3 border-b border-[var(--line-subtle)] px-4 pb-3 pt-4 md:flex xl:hidden">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Notes</h1>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMobileListOptionsOpen(true)} className="h-8 px-2.5 text-xs font-semibold">
                  Folders
                </Button>
                {addButton}
              </div>
            </div>
            {desktopSearchInput}
          </div>
          <div className="flex min-h-14 shrink-0 flex-col justify-center gap-0.5 border-b border-[var(--line-subtle)] px-3 py-1 md:min-h-0 md:border-b-0 md:px-4 md:pb-3 md:pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => returnToMobilePane("folders")}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-1 text-sm font-semibold text-[var(--primary)] hover:bg-[color:color-mix(in_srgb,var(--primary)_9%,transparent)] md:hidden"
                aria-label="Back to folders"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setMobileListOptionsOpen(true)}
                className="flex min-w-0 items-center gap-1.5 rounded-xl px-1 py-1 text-left text-lg font-bold text-[var(--text-primary)] transition-colors hover:text-[var(--primary)] md:hidden"
                aria-label="Choose folder and sorting"
              >
                <span className="max-w-[150px] truncate sm:max-w-[190px]">{search ? "Search" : activeFolderName}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="hidden items-center gap-1.5 text-lg font-bold text-[var(--text-primary)] transition-colors hover:text-[var(--primary)] xl:flex">
                    <span className="max-w-[200px] truncate">{search ? "Search" : activeFolderName}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto notes-thin-scrollbar">
                  <DropdownMenuItem onSelect={() => switchView("all")} className="font-medium">All Notes</DropdownMenuItem>
                  {folders.map(f => (
                    <DropdownMenuItem key={f.id} onSelect={() => switchView(folderView(f.id))}>{f.name}</DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Sort by</div>
                  <DropdownMenuItem onSelect={() => setSortBy("updatedAt")} className={cn(sortBy === "updatedAt" && "text-[var(--primary)] font-semibold")}>
                    Last edited {sortBy === "updatedAt" ? "✓" : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSortBy("createdAt")} className={cn(sortBy === "createdAt" && "text-[var(--primary)] font-semibold")}>
                    Date created {sortBy === "createdAt" ? "✓" : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSortBy("title")} className={cn(sortBy === "title" && "text-[var(--primary)] font-semibold")}>
                    Title {sortBy === "title" ? "✓" : ""}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
              <p className="shrink-0 text-xs font-normal text-[var(--text-muted)] md:hidden">{visibleCount} {visibleCount === 1 ? "note" : "notes"}</p>
            </div>
            <p className="mt-0.5 hidden text-xs font-normal text-[var(--text-muted)] md:block">{visibleCount} {visibleCount === 1 ? "note" : "notes"}</p>
          </div>
          <div className="min-h-0 flex-1 overscroll-y-contain overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 notes-thin-scrollbar md:pb-1">
            {loadingList && rows.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
                <span>Loading notes…</span>
              </div>
            ) : rows.length ? (
              <div className="space-y-4">
                {noteGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <h3 className="px-3.5 pt-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {group.title}
                    </h3>
                    <div className="flex flex-col gap-1">
                      {group.notes.map((row) => {
                        const isSelected = selectedId === row.id

                        return (
                          <button
                            key={row.id}
                            data-note-id={row.id}
                            ref={isSelected ? selectedRowButtonRef : undefined}
                            type="button"
                            onClick={() => void selectNote(row.id, true)}
                            onPointerEnter={() => prefetchNote(row.id)}
                            onFocus={() => prefetchNote(row.id)}
                            aria-current={isSelected ? "true" : undefined}
                            className={cn(
                              "group relative flex min-h-16 w-full flex-col justify-center rounded-xl px-3.5 py-2.5 text-left transition-colors",
                              isSelected
                                ? "bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] shadow-none"
                                : "hover:bg-[var(--surface-low)]"
                            )}
                          >
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {row.title || "New note"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                              {row.preview || "No additional text"}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 text-center">
                <NotebookPen className="mb-3 h-8 w-8 text-[var(--text-muted)]" />
                <p className="font-semibold text-[var(--text-primary)]">{search ? "No matching notes" : "No notes yet"}</p>
                {!search ? <Button type="button" variant="ghost" className="mt-2 text-xs" onClick={beginNewNote}>Create a note</Button> : null}
              </div>
            )}
            <div ref={loadMoreRef} className="h-1" />
            {loadingList && rows.length > 0 ? <p className="py-3 text-center text-xs text-[var(--text-muted)]">Loading…</p> : null}
          </div>

          {/* Notes List Resize Handle (Tablet & Desktop) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize notes list"
            title="Drag to resize notes list (double-click to reset)"
            onPointerDown={handleListResizeStart}
            onDoubleClick={() => {
              setListWidth(NOTES_LIST_DEFAULT_WIDTH)
              listWidthRef.current = NOTES_LIST_DEFAULT_WIDTH
              try {
                localStorage.setItem(NOTES_LIST_WIDTH_STORAGE_KEY, String(NOTES_LIST_DEFAULT_WIDTH))
              } catch {}
            }}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-2.5 -mr-1 z-30 cursor-col-resize select-none touch-none",
              "hidden md:flex items-center justify-center hover:bg-[color:color-mix(in_srgb,var(--primary)_20%,transparent)] transition-colors group/resizer",
              isResizingList && "bg-[color:color-mix(in_srgb,var(--primary)_30%,transparent)]"
            )}
          >
            <div
              className={cn(
                "w-0.5 h-7 rounded-full bg-transparent group-hover/resizer:bg-[var(--primary)] transition-colors",
                isResizingList && "bg-[var(--primary)]"
              )}
            />
          </div>
        </section>

        {/* Column 3: Editor */}
        <div data-slot="notes-editor" className={cn("h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-transparent", mobilePane === "editor" ? "block" : "hidden", "md:block")}>
          {loadingDetail ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">Loading note…</div>
          ) : selectedNote && shouldRenderEditor ? (
            <NoteEditorSession
              key={`${selectedNote.id}:${editorSessionVersion}`}
              ref={editorSessionRef}
              note={selectedNote}
              folders={folders}
              focusToken={focusToken}
              isPinned={pinnedIds.has(selectedNote.id)}
              onTogglePin={() => togglePin(selectedNote.id)}
              onDuplicate={duplicateCurrentNote}
              onMoveToFolder={() => setNoteToMove(selectedNote)}
              onSaved={applySavedNote}
              onCreated={applySavedNote}
              onForkCreated={(note) => { applySavedNote(note); selectedIdRef.current = note.id; selectedNoteRef.current = note; setSelectedId(note.id); setSelectedNote(note); setFocusToken((token) => (token ?? 0) + 1) }}
              onMeaningfulDraft={(noteId) => commitRows((current) => current.map((row) => row.id === noteId ? { ...row, hasLocalContent: true } : row))}
              onLocalFolderChanged={applyLocalFolderChange}
              onBack={() => returnToMobilePane("list")}
              onDelete={() => setNoteToDelete(selectedNote)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <NotebookPen className="mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <p className="text-lg font-semibold text-[var(--text-primary)]">Select a note or start a new one</p>
              <Button type="button" className="mt-4" onClick={beginNewNote}>New Note</Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={mobileListOptionsOpen} onOpenChange={setMobileListOptionsOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[80dvh] rounded-t-[24px] border-x-0 border-b-0 border-t border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-0 xl:hidden"
        >
          <SheetTitle className="sr-only">Choose notes folder and sorting</SheetTitle>
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[var(--line-subtle)]" />
          <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 notes-thin-scrollbar">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Folders</p>
              <button
                type="button"
                onClick={() => { setMobileListOptionsOpen(false); setFolderDialog({ mode: "create" }); setFolderName("") }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
                aria-label="Add folder"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => { setMobileListOptionsOpen(false); switchView("all") }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors",
                  view === "all" ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] font-semibold text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                )}
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">All Notes</span>
                <span className="text-xs tabular-nums opacity-70">{allCount}</span>
              </button>
              {folders.map((folder) => {
                const isActive = activeFolderId === folder.id
                return (
                  <div
                    key={folder.id}
                    className={cn(
                      "flex min-h-11 w-full items-center rounded-xl text-sm transition-colors",
                      isActive ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] font-semibold text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => { setMobileListOptionsOpen(false); switchView(folderView(folder.id)) }}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left"
                    >
                      <Folder className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                      <span className="text-xs tabular-nums opacity-70">{folder.count}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="mr-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-highest)]" aria-label={`${folder.name} actions`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setMobileListOptionsOpen(false); setFolderDialog({ mode: "rename", folder }); setFolderName(folder.name) }}>Rename</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => { setMobileListOptionsOpen(false); setFolderToDelete(folder) }}>Delete folder</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>

            <p className="mt-5 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Sort by</p>
            <div className="space-y-1">
              {([
                ["updatedAt", "Last edited"],
                ["createdAt", "Date created"],
                ["title", "Title"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSortBy(value); setMobileListOptionsOpen(false) }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition-colors",
                    sortBy === value ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] font-semibold text-[var(--primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                  )}
                >
                  <span>{label}</span>
                  {sortBy === value ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Move Note Dialog */}
      <Dialog open={Boolean(noteToMove)} onOpenChange={(open) => { if (!open) setNoteToMove(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Move to folder</DialogTitle></DialogHeader>
          <div className="space-y-1 py-2">
            <button
              type="button"
              onClick={() => void moveNoteToFolder(null)}
              disabled={pendingAction === "move"}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                noteToMove?.folderId === null ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] font-semibold" : "hover:bg-[var(--surface-low)]"
              )}
            >
              <Folder className="h-4 w-4" />
              <span>All Notes (No folder)</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => void moveNoteToFolder(folder.id)}
                disabled={pendingAction === "move"}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                  noteToMove?.folderId === folder.id ? "bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] font-semibold" : "hover:bg-[var(--surface-low)]"
                )}
              >
                <Folder className="h-4 w-4" />
                <span>{folder.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(folderDialog)} onOpenChange={(open) => { if (!open) setFolderDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}</DialogTitle></DialogHeader>
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" autoFocus onKeyDown={(event) => { if (event.key === "Enter") void createOrRenameFolder() }} />
          <DialogFooter><Button type="button" onClick={() => void createOrRenameFolder()} disabled={!folderName.trim() || pendingAction === "folder"}>{folderDialog?.mode === "rename" ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(folderToDelete)} onOpenChange={(open) => { if (!open) setFolderToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete folder?</AlertDialogTitle><AlertDialogDescription>Notes in this folder will move to All Notes. The notes will not be deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={pendingAction === "delete-folder"} onClick={() => void confirmDeleteFolder()}>Delete folder</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(noteToDelete)} onOpenChange={(open) => { if (!open) setNoteToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this note permanently?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={pendingAction === "delete-note"} onClick={() => void confirmDeleteNote()}>Delete permanently</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(isResizingFolders || isResizingList) ? (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto" />
      ) : null}
    </div>
  )
}
