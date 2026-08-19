"use client"

import * as React from "react"
import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns"
import {
  ChevronLeft,
  FilePlus2,
  Folder,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Trash2,
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
import { AppPageHeader } from "@/components/layout/app-page-header"
import { NotesSearchInput } from "@/components/notes/notes-search-input"
import { RichTextEditor, type RichTextFolderOption } from "@/components/ui/rich-text-editor"
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
  folderMentionHtml,
  readFolderMentionId,
  removeFolderMentions,
} from "@/lib/notes/folder-mentions"
import { hasMeaningfulRichTextContent, hasNoteContentStateChanged } from "@/lib/notes/content"
import { deriveNoteTitleFromContent, derivePreviewBodyFromContent } from "@/lib/notes/derived-note-text"
import { cn } from "@/lib/utils"

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
type NoteEditorSessionHandle = {
  cancelPendingSaves: () => Promise<boolean>
  flushPendingSaves: () => Promise<boolean>
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
    const raw = window.localStorage.getItem(`notes.draft.${note.id}`)
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
  focusToken: number
  onSaved: (note: NoteDetail) => void
  onCreated: (note: NoteDetail) => void
  onForkCreated: (note: NoteDetail) => void
  onMeaningfulDraft: (noteId: string) => void
  onBack: () => void
  onDelete: () => void
}>(function NoteEditorSession({
  note,
  folders,
  focusToken,
  onSaved,
  onCreated,
  onForkCreated,
  onMeaningfulDraft,
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
      if (!dirtyRef.current) window.localStorage.removeItem(`notes.draft.${note.id}`)
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
    if (!dirtyRef.current) window.localStorage.removeItem(`notes.draft.${note.id}`)
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
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
      if (dirtyRef.current && !cancelledRef.current) void enqueueSave()
    }
  }, [enqueueSave])

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
      if (dirtyRef.current) await enqueueSave()
      return saveQueueRef.current.catch(() => false)
    },
  }), [enqueueSave])

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
      window.localStorage.removeItem(`notes.draft.${note.id}`)
      return
    }
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
    recoveryTimerRef.current = setTimeout(() => {
      window.localStorage.setItem(
        `notes.draft.${note.id}`,
        JSON.stringify({ content: draftRef.current, revision: revisionRef.current, folderId: folderIdRef.current })
      )
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

  const assignFolder = React.useCallback((nextFolderId: string | null) => {
    const folder = folders.find((item) => item.id === nextFolderId) ?? null
    const contentWithoutMentions = removeFolderMentions(draftRef.current).trimStart()
    const content = folder
      ? `${contentWithoutMentions}<p>${folderMentionHtml(folder)}</p>`
      : contentWithoutMentions
    setExternalUpdateToken((token) => token + 1)
    flushFolderChange(nextFolderId, content)
  }, [folders, flushFolderChange])

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
    window.localStorage.removeItem(`notes.draft.${note.id}`)
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

  const currentFolderName = folders.find((folder) => folder.id === folderId)?.name
    ?? ALL_NOTES_FOLDER_LABEL

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--surface-lowest)]" aria-label="Note editor">
      <div className="flex min-h-14 items-center gap-2 border-b border-[var(--line-subtle)] px-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--surface-low)] md:hidden"
          aria-label="Back to notes"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Notes</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex min-h-9 min-w-0 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-low)]">
              <Folder className="h-4 w-4 shrink-0" />
              <span className="truncate">{currentFolderName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
            <DropdownMenuItem onSelect={() => assignFolder(null)}>All Notes</DropdownMenuItem>
            <DropdownMenuSeparator />
            {folders.map((folder) => (
              <DropdownMenuItem key={folder.id} onSelect={() => assignFolder(folder.id)}>
                {folder.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className={cn(
          "ml-auto text-xs font-medium",
          saveState === "error" || saveState === "conflict" ? "text-[var(--state-urgent)]" : "text-[var(--text-muted)]"
        )}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : saveState === "conflict" ? "Changed elsewhere" : ""}
        </span>
        {saveState === "error" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void enqueueSave()}>Retry</Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="shrink-0 gap-1.5 text-[var(--state-urgent)] hover:bg-[var(--state-danger-surface)] hover:text-[var(--state-urgent)]"
          aria-label="Delete note"
          title="Delete note"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {saveState === "conflict" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-subtle)] bg-[var(--state-danger-surface)] px-4 py-2 text-sm text-[var(--state-urgent)]">
          <span className="mr-auto">This note changed in another view. Your draft is preserved.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void reloadServerVersion()}>Reload server version</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void keepAsNewNote()}>Keep as new note</Button>
          <Button type="button" size="sm" onClick={() => void keepMyDraft()}>Keep my draft</Button>
        </div>
      ) : null}

      <RichTextEditor
        value={draft}
        onChange={handleChange}
        onBlur={() => { if (dirtyRef.current) void enqueueSave() }}
        placeholder="Start writing… Type # to choose a folder"
        variant="plain"
        mode="document"
        panelStyle="borderless"
        documentLayout="left"
        documentWidth="full"
        toolbarVisibility="focus"
        toolbarPreset="minimal"
        toolbarTone="quiet"
        toolbarPinned
        notesMode
        notesAppearance="apple"
        focusToken={focusToken}
        showImageGallery={false}
        folderOptions={folderOptions}
        onFolderMentionChange={flushFolderChange}
        externalUpdateToken={externalUpdateToken}
        className="min-h-0 flex-1"
        minHeightClassName="min-h-full"
      />
    </section>
  )
}))

function formatNoteSnippetDate(date: Date, now: Date = new Date()): string {
  if (isToday(date)) {
    return format(date, "HH:mm")
  }
  if (isYesterday(date)) {
    return "Yesterday"
  }
  const daysDiff = differenceInCalendarDays(now, date)
  if (daysDiff >= 0 && daysDiff <= 7) {
    return format(date, "EEEE")
  }
  return format(date, "dd/MM/yyyy")
}

function groupNotesByDate(rows: ClientNoteRow[]): Array<{ title: string; notes: ClientNoteRow[] }> {
  const now = new Date()
  const groups: Record<string, ClientNoteRow[]> = {}
  const groupOrder: string[] = []

  for (const row of rows) {
    const date = new Date(row.updatedAt)
    let section = "Previous 30 Days"

    if (isToday(date)) {
      section = "Today"
    } else if (isYesterday(date)) {
      section = "Yesterday"
    } else if (differenceInCalendarDays(now, date) <= 7 && differenceInCalendarDays(now, date) >= 0) {
      section = "Previous 7 Days"
    } else if (differenceInCalendarDays(now, date) <= 30 && differenceInCalendarDays(now, date) >= 0) {
      section = "Previous 30 Days"
    } else if (date.getFullYear() === now.getFullYear()) {
      section = format(date, "MMMM")
    } else {
      section = format(date, "yyyy")
    }

    if (!groups[section]) {
      groups[section] = []
      groupOrder.push(section)
    }
    groups[section].push(row)
  }

  return groupOrder.map((title) => ({
    title,
    notes: groups[title],
  }))
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
  const [focusToken, setFocusToken] = React.useState(0)
  const [editorSessionVersion, setEditorSessionVersion] = React.useState(0)
  const [mobilePane, setMobilePane] = React.useState<MobilePane>(startNewNote || requestedNoteId ? "editor" : "list")
  const [folderDialog, setFolderDialog] = React.useState<{ mode: "create" | "rename"; folder?: NoteFolderRecord } | null>(null)
  const [folderName, setFolderName] = React.useState("")
  const [folderToDelete, setFolderToDelete] = React.useState<NoteFolderRecord | null>(null)
  const [noteToDelete, setNoteToDelete] = React.useState<ClientNoteDetail | null>(null)
  const detailCacheRef = React.useRef(new Map<string, NoteDetail>())
  const rowsRef = React.useRef<ClientNoteRow[]>(initialRows)
  const selectedIdRef = React.useRef<string | null>(initialSelectedNote?.id ?? null)
  const selectedNoteRef = React.useRef<ClientNoteDetail | null>(initialSelectedNote)
  const listRequestRef = React.useRef(0)
  const detailRequestRef = React.useRef(0)
  const initialQueryRef = React.useRef(true)
  const startNewHandledRef = React.useRef(false)
  const recoveredDraftHandledRef = React.useRef(false)
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)
  const editorSessionRef = React.useRef<NoteEditorSessionHandle | null>(null)

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
    setRows((current) => current.filter((item) => item.id !== noteId))
    setAllCount((count) => Math.max(0, count - 1))
    if (row.folderId) {
      setFolders((current) => current.map((folder) => folder.id === row.folderId ? { ...folder, count: Math.max(0, folder.count - 1) } : folder))
    }
    window.localStorage.removeItem(`notes.draft.${noteId}`)
    detailCacheRef.current.delete(noteId)
  }, [])

  const selectNote = React.useCallback(async (noteId: string, shouldSwitchMobilePane = true) => {
    if (selectedIdRef.current !== noteId) discardBlankLocalNote(selectedIdRef.current)
    selectedIdRef.current = noteId
    setSelectedId(noteId)
    if (shouldSwitchMobilePane) {
      setMobilePane("editor")
    }
    setFocusToken((token) => token + 1)
    const cached = detailCacheRef.current.get(noteId)
    if (cached) {
      setSelectedNote(cached)
      return
    }
    const currentSelected = selectedNoteRef.current
    const local = currentSelected?.id === noteId && currentSelected.localOnly ? currentSelected : null
    if (local) return
    const request = ++detailRequestRef.current
    setLoadingDetail(true)
    try {
      const result = await getNoteDetail(noteId)
      if (request !== detailRequestRef.current) return
      if (!result.success) {
        toast.error(result.error)
        return
      }
      cacheDetail(result.data)
      setSelectedNote(result.data)
    } finally {
      if (request === detailRequestRef.current) {
        setLoadingDetail(false)
      }
    }
  }, [cacheDetail, discardBlankLocalNote])

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
    setRows((current) => [{ ...rowFromDetail(detail), localOnly: true }, ...current])
    setAllCount((count) => count + 1)
    if (selectedFolderId) {
      setFolders((current) => current.map((folder) => folder.id === selectedFolderId ? { ...folder, count: folder.count + 1 } : folder))
    }
    selectedIdRef.current = id
    selectedNoteRef.current = detail
    setSelectedId(id)
    setSelectedNote(detail)
    setMobilePane("editor")
    setFocusToken((token) => token + 1)
  }, [discardBlankLocalNote, selectedId, view])

  React.useEffect(() => {
    if (recoveredDraftHandledRef.current || startNewNote || !requestedNoteId) return
    recoveredDraftHandledRef.current = true
    if (initialRows.some((row) => row.id === requestedNoteId)) return
    try {
      const raw = window.localStorage.getItem(`notes.draft.${requestedNoteId}`)
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
      setRows((current) => [{ ...rowFromDetail(detail), localOnly: true, hasLocalContent: true }, ...current])
      setAllCount((count) => count + 1)
      if (folderId) setFolders((current) => current.map((folder) => folder.id === folderId ? { ...folder, count: folder.count + 1 } : folder))
      setSelectedId(requestedNoteId)
      setSelectedNote(detail)
      setMobilePane("editor")
      setFocusToken((token) => token + 1)
    } catch {
      // Ignore malformed recovery data.
    }
  }, [folders, initialRows, requestedNoteId, startNewNote])

  React.useEffect(() => {
    if (!startNewNote || startNewHandledRef.current) return
    startNewHandledRef.current = true
    beginNewNote()
  }, [beginNewNote, startNewNote])

  React.useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("view", view)
    if (selectedId) url.searchParams.set("note", selectedId)
    else url.searchParams.delete("note")
    url.searchParams.delete("new")
    window.history.replaceState({}, "", `${url.pathname}${url.search}`)
  }, [selectedId, view])

  const replaceList = React.useCallback(async (nextView: NotesView, query: string) => {
    const request = ++listRequestRef.current
    setLoadingList(true)
    try {
      const result = await queryNoteList({ view: nextView, q: query, pageSize: 50 })
      if (request !== listRequestRef.current) return
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setRows(result.data.rows)
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
      if (request === listRequestRef.current) {
        setLoadingList(false)
      }
    }
  }, [selectNote])

  const switchView = React.useCallback((nextView: NotesView) => {
    if (view === nextView) {
      setMobilePane("list")
      return
    }
    const targetFolderId = folderIdFromView(nextView)
    // Instantly filter out notes from other folders so no old notes flash under the new folder
    setRows((current) => {
      if (nextView === "all") return current
      if (!targetFolderId) return []
      return current.filter((row) => row.folderId === targetFolderId)
    })
    previousViewRef.current = nextView
    setView(nextView)
    setMobilePane("list")
    void replaceList(nextView, search)
  }, [replaceList, search, view])

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
    setLoadingList(true)
    try {
      const result = await queryNoteList({ view, q: search, cursor: nextCursor, pageSize: 50 })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setRows((current) => {
        const known = new Set(current.map((row) => row.id))
        return [...current, ...result.data.rows.filter((row) => !known.has(row.id))]
      })
      setNextCursor(result.data.nextCursor)
    } finally {
      setLoadingList(false)
    }
  }, [loadingList, nextCursor, search, view])

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
    if (previous?.folderId !== note.folderId) {
      setFolders((currentFolders) => currentFolders.map((folder) => {
        if (folder.id === previous?.folderId) return { ...folder, count: Math.max(0, folder.count - 1) }
        if (folder.id === note.folderId) return { ...folder, count: folder.count + 1 }
        return folder
      }))
    }
    setRows((current) => sortRows([{ ...rowFromDetail(note) }, ...current.filter((row) => row.id !== note.id)]))
  }, [cacheDetail])

  const createOrRenameFolder = React.useCallback(async () => {
    if (!folderDialog || !folderName.trim()) return
    if (folderDialog.mode === "rename" && selectedNote?.localOnly && selectedNote.folderId === folderDialog.folder?.id) {
      toast.error("Write and save the new note before renaming its folder.")
      return
    }
    if (folderDialog.mode === "rename" && selectedNote?.folderId === folderDialog.folder?.id) {
      const flushed = await editorSessionRef.current?.flushPendingSaves()
      if (flushed === false) {
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
  }, [applySavedNote, folderDialog, folderName, selectedNote])

  const confirmDeleteFolder = React.useCallback(async () => {
    if (!folderToDelete) return
    if (selectedNote?.localOnly && selectedNote.folderId === folderToDelete.id) {
      toast.error("Write and save the new note before deleting its folder.")
      return
    }
    if (selectedNote?.folderId === folderToDelete.id) {
      const flushed = await editorSessionRef.current?.flushPendingSaves()
      if (flushed === false) {
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
    setRows((current) => current.map((row) => row.folderId === folderToDelete.id ? { ...row, folderId: null } : row))
    if (view === folderView(folderToDelete.id)) setView("all")
    if (selectedNote?.folderId === folderToDelete.id) {
      const refreshed = await getNoteDetail(selectedNote.id)
      if (refreshed.success) {
        applySavedNote(refreshed.data)
        setEditorSessionVersion((version) => version + 1)
      }
    }
    setFolderToDelete(null)
  }, [applySavedNote, folderToDelete, selectedNote, view])

  const confirmDeleteNote = React.useCallback(async () => {
    if (!noteToDelete) return
    const persisted = await editorSessionRef.current?.cancelPendingSaves()
      ?? !noteToDelete.localOnly
    if (persisted) {
      const result = await permanentlyDeleteNote(noteToDelete.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
    }
    setRows((current) => current.filter((row) => row.id !== noteToDelete.id))
    setAllCount((count) => Math.max(0, count - 1))
    if (noteToDelete.folderId) {
      setFolders((current) => current.map((folder) => folder.id === noteToDelete.folderId ? { ...folder, count: Math.max(0, folder.count - 1) } : folder))
    }
    detailCacheRef.current.delete(noteToDelete.id)
    window.localStorage.removeItem(`notes.draft.${noteToDelete.id}`)
    const next = rows.find((row) => row.id !== noteToDelete.id)
    setNoteToDelete(null)
    if (next) void selectNote(next.id)
    else {
      setSelectedId(null)
      setSelectedNote(null)
      setMobilePane("list")
    }
  }, [noteToDelete, rows, selectNote])

  const searchInput = <NotesSearchInput value={search} onChange={setSearch} variant="apple" />
  const addButton = (
    <Button type="button" onClick={beginNewNote} className="min-h-10 gap-2 rounded-[14px] px-4">
      <FilePlus2 className="h-4 w-4" />
      <span className="hidden sm:inline">New Note</span>
    </Button>
  )

  const activeFolderId = folderIdFromView(view)
  const visibleCount = search ? totalCount : view === "all" ? allCount : folders.find((folder) => folder.id === activeFolderId)?.count ?? totalCount
  const noteGroups = React.useMemo(() => groupNotesByDate(rows), [rows])

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-4 md:px-5 md:pt-5 xl:px-7 xl:pt-7 2xl:px-8">
        <AppPageHeader title="Notes" search={searchInput} primaryAction={addButton} />
      </div>

      <div className="grid flex-1 bg-[var(--surface-lowest)] md:grid-cols-[230px_240px_minmax(0,1fr)] lg:grid-cols-[230px_270px_minmax(0,1fr)] min-h-[560px]">
        <aside className={cn("min-h-0 flex-col border-r border-[var(--line-subtle)] bg-[var(--surface-low)]", mobilePane === "folders" ? "flex" : "hidden", "md:flex")}>
          <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3.5 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Folders</span>
            <button
              type="button"
              onClick={() => { setFolderDialog({ mode: "create" }); setFolderName("") }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Add folder"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1" aria-label="Note folders">
            <button
              type="button"
              onClick={() => switchView("all")}
              className={cn(
                "flex min-h-8.5 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                view === "all"
                  ? "bg-[var(--surface-lowest)] text-[var(--text-primary)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-lowest)]/70 hover:text-[var(--text-primary)]"
              )}
            >
              <Folder className={cn("h-4 w-4 shrink-0", view === "all" ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]")} />
              <span className="min-w-0 flex-1 truncate text-left">All Notes</span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-muted)]">{allCount}</span>
            </button>
            {folders.map((folder) => {
              const isActive = activeFolderId === folder.id
              return (
                <div
                  key={folder.id}
                  className={cn(
                    "group relative flex min-h-8.5 items-center rounded-lg transition-colors",
                    isActive ? "bg-[var(--surface-lowest)] shadow-xs font-semibold" : "hover:bg-[var(--surface-lowest)]/70"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => switchView(folderView(folder.id))}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pl-2.5 pr-2 text-left text-sm text-[var(--text-secondary)]"
                  >
                    <Folder className={cn("h-4 w-4 shrink-0", isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]")} />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", isActive ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]")}>{folder.name}</span>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-muted)] transition-opacity md:group-hover:opacity-0 md:group-focus-within:opacity-0">
                      {folder.count}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center pr-1 md:absolute md:right-1 md:top-1/2 md:-translate-y-1/2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md text-[var(--text-muted)] transition-opacity hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start gap-2.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={() => { setFolderDialog({ mode: "create" }); setFolderName("") }}
            >
              <FolderPlus className="h-3.5 w-3.5" />Add Folder
            </Button>
          </nav>
        </aside>

        <section className={cn("min-h-0 flex-col border-r border-[var(--line-subtle)] bg-[var(--surface-lowest)]", mobilePane === "list" ? "flex" : "hidden", "md:flex")} aria-label="Notes list">
          <div className="flex min-h-14 items-center gap-2 border-b border-[var(--line-subtle)] px-3">
            <button
              type="button"
              onClick={() => setMobilePane("folders")}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--surface-low)] md:hidden"
              aria-label="Show folders"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Folders</span>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">{search ? "Search" : activeFolderId ? folders.find((folder) => folder.id === activeFolderId)?.name : "All Notes"}</h2>
              <p className="text-xs tabular-nums text-[var(--text-muted)]">{visibleCount} {visibleCount === 1 ? "note" : "notes"}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={beginNewNote} aria-label="New note"><FilePlus2 className="h-4 w-4" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingList && rows.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" />
                <span>Loading notes…</span>
              </div>
            ) : rows.length ? (
              <div className="space-y-4">
                {noteGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <h3 className="px-2 pt-1 text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                      {group.title}
                    </h3>
                    <div className="rounded-[14px] bg-[var(--surface-lowest)]">
                      {group.notes.map((row, index) => {
                        const isSelected = selectedId === row.id
                        const showDivider = index < group.notes.length - 1 && !isSelected && selectedId !== group.notes[index + 1]?.id
                        const snippetDate = formatNoteSnippetDate(new Date(row.updatedAt))
                        const folderName = folders.find((folder) => folder.id === row.folderId)?.name ?? ALL_NOTES_FOLDER_LABEL

                        return (
                          <React.Fragment key={row.id}>
                            <button
                              type="button"
                              onClick={() => void selectNote(row.id, true)}
                              className={cn(
                                "group relative flex w-full flex-col gap-0.5 rounded-[12px] px-3 py-2 text-left transition-colors",
                                isSelected
                                  ? "bg-[var(--state-info-surface)] shadow-xs"
                                  : "hover:bg-[var(--surface-low)]/80"
                              )}
                            >
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]")}>
                                  {row.title || "New note"}
                                </span>
                              </div>
                              <div className="flex min-w-0 items-baseline gap-2 text-xs">
                                <span className="shrink-0 font-medium text-[var(--text-primary)] opacity-90">
                                  {snippetDate}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)] opacity-80">
                                  {row.preview || "No additional text"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                                <Folder className="h-3 w-3 shrink-0 opacity-70" />
                                <span className="truncate">{folderName}</span>
                              </div>
                            </button>
                            {showDivider ? (
                              <div className="mx-3 border-b border-[var(--line-subtle)]" />
                            ) : null}
                          </React.Fragment>
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
                {!search ? <Button type="button" variant="ghost" className="mt-2" onClick={beginNewNote}>Create a note</Button> : null}
              </div>
            )}
            <div ref={loadMoreRef} className="h-1" />
            {loadingList && rows.length > 0 ? <p className="py-3 text-center text-xs text-[var(--text-muted)]">Loading…</p> : null}
          </div>
        </section>

        <div className={cn("min-h-0 min-w-0", mobilePane === "editor" ? "block" : "hidden", "md:block")}>
          {loadingDetail ? (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">Loading note…</div>
          ) : selectedNote ? (
            <NoteEditorSession
              key={`${selectedNote.id}:${editorSessionVersion}`}
              ref={editorSessionRef}
              note={selectedNote}
              folders={folders}
              focusToken={focusToken}
              onSaved={applySavedNote}
              onCreated={applySavedNote}
              onForkCreated={(note) => { applySavedNote(note); setAllCount((count) => count + 1); selectedIdRef.current = note.id; selectedNoteRef.current = note; setSelectedId(note.id); setSelectedNote(note); setFocusToken((token) => token + 1) }}
              onMeaningfulDraft={(noteId) => setRows((current) => current.map((row) => row.id === noteId ? { ...row, hasLocalContent: true } : row))}
              onBack={() => setMobilePane("list")}
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

      <Dialog open={Boolean(folderDialog)} onOpenChange={(open) => { if (!open) setFolderDialog(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}</DialogTitle></DialogHeader>
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" autoFocus onKeyDown={(event) => { if (event.key === "Enter") void createOrRenameFolder() }} />
          <DialogFooter><Button type="button" onClick={() => void createOrRenameFolder()} disabled={!folderName.trim()}>{folderDialog?.mode === "rename" ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(folderToDelete)} onOpenChange={(open) => { if (!open) setFolderToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete folder?</AlertDialogTitle><AlertDialogDescription>Notes in this folder will move to All Notes. The notes will not be deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void confirmDeleteFolder()}>Delete folder</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(noteToDelete)} onOpenChange={(open) => { if (!open) setNoteToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this note permanently?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void confirmDeleteNote()}>Delete permanently</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
