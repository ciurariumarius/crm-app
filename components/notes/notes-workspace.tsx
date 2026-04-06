"use client"

import * as React from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Archive, ArchiveRestore, FilePlus2, FolderKanban, ListTodo, NotebookPen, Pin, PinOff, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createNote, deleteNote, setNoteArchived, setNotePinned, updateNote, type NoteRecord } from "@/lib/actions/notes"
import { updateProject } from "@/lib/actions/projects"
import { updateTask } from "@/lib/actions/tasks"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { NotesSearchInput } from "@/components/notes/notes-search-input"
import { cn } from "@/lib/utils"

type NotesWorkspaceProps = {
  initialNotes: NoteRecord[]
  initialSelectedNoteId: string | null
  storageUnavailable?: boolean
}

function getDefaultNoteTitle(dateLike: Date | string = new Date()) {
  return format(new Date(dateLike), "dd.MM.yyyy")
}

function getMeaningfulTitle(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.toLowerCase() === "untitled" || trimmed.toLowerCase() === "untitled note") return ""
  return trimmed
}

function normalizeTitle(value: string, dateLike?: Date | string) {
  const meaningful = getMeaningfulTitle(value)
  return meaningful.length > 0 ? meaningful : getDefaultNoteTitle(dateLike)
}

function getNoteDisplayTitle(note: Pick<NoteRecord, "title" | "createdAt">) {
  return normalizeTitle(note.title, note.createdAt)
}

function getNotePreview(note: NoteRecord) {
  const source = note.contentText?.trim()
    ? note.contentText
    : (note.content || "").replace(/<[^>]*>/g, " ")
  const compact = source.replace(/\s+/g, " ").trim()
  if (!compact) return "No content yet"
  if (compact.length <= 80) return compact
  return `${compact.slice(0, 80)}...`
}

const PROJECT_REQUIREMENTS_TEMPLATE = [
  "<h2>Requirements</h2>",
  "<ul>",
  "<li><strong>Goal:</strong> </li>",
  "<li><strong>Deliverables:</strong> </li>",
  "<li><strong>Tracking scope (GTM / GA4 / Pixel):</strong> </li>",
  "<li><strong>Constraints:</strong> </li>",
  "</ul>",
  "<h3>Implementation Notes</h3>",
  "<p></p>",
  "<h3>Screenshots</h3>",
  "<p></p>",
].join("")

const TASK_NOTES_TEMPLATE = [
  "<h2>Context</h2>",
  "<p></p>",
  "<h2>Checklist</h2>",
  "<ul>",
  "<li></li>",
  "</ul>",
  "<h2>Screenshots</h2>",
  "<p></p>",
].join("")

function toContentText(content: string) {
  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function getNoteSourceType(note: NoteRecord | null | undefined) {
  if (!note) return "note" as const
  if (note.sourceType === "project" || note.id.startsWith("project:")) return "project" as const
  if (note.sourceType === "task" || note.id.startsWith("task:")) return "task" as const
  return "note" as const
}

function normalizeNoteContentForEditor(content: string) {
  const raw = (content || "").trim()
  if (!raw) return ""
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")

  return raw
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

function sortNotes(items: NoteRecord[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

function upsertNote(items: NoteRecord[], next: NoteRecord) {
  const withoutCurrent = items.filter((item) => item.id !== next.id)
  return sortNotes([next, ...withoutCurrent])
}

export function NotesWorkspace({
  initialNotes,
  initialSelectedNoteId,
  storageUnavailable = false,
}: NotesWorkspaceProps) {
  const [notes, setNotes] = React.useState<NoteRecord[]>(() => sortNotes(initialNotes))
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(initialSelectedNoteId)
  const [titleDraft, setTitleDraft] = React.useState("")
  const [contentDraft, setContentDraft] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [showArchived, setShowArchived] = React.useState(false)
  const [isMobileListOpen, setIsMobileListOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)

  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const lastSyncedRef = React.useRef<{ id: string | null; title: string; content: string }>({
    id: null,
    title: "",
    content: "",
  })
  const bootstrappedRef = React.useRef(false)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedNote = React.useMemo(
    () => notes.find((item) => item.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  )
  const selectedNoteSourceType = React.useMemo(() => getNoteSourceType(selectedNote), [selectedNote])
  const selectedNoteIsLinked = selectedNoteSourceType !== "note"
  const editorUploadContextId = React.useMemo(() => {
    if (!selectedNote) return undefined
    if (selectedNoteSourceType === "project") {
      return selectedNote.sourceId || selectedNote.id.replace(/^project:/, "")
    }
    if (selectedNoteSourceType === "task") {
      return (
        selectedNote.sourceProjectId ||
        selectedNote.sourceId ||
        selectedNote.id.replace(/^task:/, "")
      )
    }
    return selectedNote.id
  }, [selectedNote, selectedNoteSourceType])

  React.useEffect(() => {
    if (!selectedNote) {
      setTitleDraft("")
      setContentDraft("")
      lastSyncedRef.current = { id: null, title: "", content: "" }
      return
    }

    const displayTitle = getNoteDisplayTitle(selectedNote)
    const normalizedContent = normalizeNoteContentForEditor(selectedNote.content || "")
    setTitleDraft(displayTitle)
    setContentDraft(normalizedContent)
    lastSyncedRef.current = {
      id: selectedNote.id,
      title: displayTitle,
      content: normalizedContent,
    }
  }, [selectedNote])

  const visibleNotes = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    return notes.filter((note) => {
      if (note.archived !== showArchived) return false
      if (!needle) return true
      return (
        note.title.toLowerCase().includes(needle) ||
        note.contentText.toLowerCase().includes(needle) ||
        (note.sourceLabel || "").toLowerCase().includes(needle)
      )
    })
  }, [notes, search, showArchived])

  const persistNote = React.useCallback(
    async (noteId: string, titleValue: string, contentValue: string) => {
      const existingNote = notes.find((item) => item.id === noteId) ?? null
      if (!existingNote) return false
      const sourceType = getNoteSourceType(existingNote)
      const normalizedTitle = normalizeTitle(titleValue, existingNote?.createdAt)
      const snapshot = lastSyncedRef.current
      if (snapshot.id === noteId && snapshot.title === normalizedTitle && snapshot.content === contentValue) {
        return true
      }

      if (sourceType === "project") {
        const projectId = existingNote.sourceId || existingNote.id.replace(/^project:/, "")
        const result = await updateProject(projectId, { description: contentValue })
        if (!result.success) {
          toast.error(result.error || "Failed to save project note")
          return false
        }
        const nowIso = new Date().toISOString()
        setNotes((current) =>
          sortNotes(
            current.map((item) =>
              item.id === existingNote.id
                ? {
                    ...item,
                    content: contentValue,
                    contentText: toContentText(contentValue),
                    updatedAt: nowIso,
                  }
                : item
            )
          )
        )
        lastSyncedRef.current = {
          id: existingNote.id,
          title: existingNote.title,
          content: contentValue,
        }
        return true
      }

      if (sourceType === "task") {
        const taskId = existingNote.sourceId || existingNote.id.replace(/^task:/, "")
        const result = await updateTask(taskId, { description: contentValue })
        if (!result.success) {
          toast.error(result.error || "Failed to save task note")
          return false
        }
        const nowIso = new Date().toISOString()
        setNotes((current) =>
          sortNotes(
            current.map((item) =>
              item.id === existingNote.id
                ? {
                    ...item,
                    content: contentValue,
                    contentText: toContentText(contentValue),
                    updatedAt: nowIso,
                  }
                : item
            )
          )
        )
        lastSyncedRef.current = {
          id: existingNote.id,
          title: existingNote.title,
          content: contentValue,
        }
        return true
      }

      if (storageUnavailable) {
        toast.error("Notes storage is not ready yet")
        return false
      }

      const result = await updateNote(noteId, {
        title: normalizedTitle,
        content: contentValue,
      })

      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to save note")
        return false
      }

      setNotes((current) => upsertNote(current, result.data as NoteRecord))
      lastSyncedRef.current = {
        id: result.data.id,
        title: result.data.title,
        content: result.data.content,
      }
      return true
    },
    [notes, storageUnavailable]
  )

  const handleCreateNote = React.useCallback(
    async (prefill?: { title?: string; content?: string }) => {
      if (storageUnavailable) {
        toast.error("Notes storage is not ready yet")
        return null
      }
      setIsCreating(true)
      try {
        const defaultTitle = getDefaultNoteTitle()
        const result = await createNote({
          title: normalizeTitle(prefill?.title || "", defaultTitle),
          content: prefill?.content || "",
        })
        if (!result.success || !result.data) {
          toast.error(result.error || "Failed to create note")
          return null
        }

        setNotes((current) => upsertNote(current, result.data as NoteRecord))
        setShowArchived(false)
        setSelectedNoteId(result.data.id)
        setIsMobileListOpen(false)
        return result.data.id
      } finally {
        setIsCreating(false)
      }
    },
    [storageUnavailable]
  )

  React.useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    if (notes.length === 0 && !storageUnavailable) {
      void handleCreateNote({ title: getDefaultNoteTitle(), content: "" })
    } else if (!selectedNoteId) {
      const firstActive = notes.find((note) => !note.archived) ?? notes[0]
      if (firstActive) setSelectedNoteId(firstActive.id)
    }
  }, [handleCreateNote, notes, selectedNoteId, storageUnavailable])

  React.useEffect(() => {
    if (!selectedNoteId) return
    if (selectedNoteSourceType === "note" && storageUnavailable) return
    const normalizedTitle = normalizeTitle(titleDraft, selectedNote?.createdAt)
    const currentSnapshot = lastSyncedRef.current
    if (
      currentSnapshot.id === selectedNoteId &&
      currentSnapshot.title === normalizedTitle &&
      currentSnapshot.content === contentDraft
    ) {
      return
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistNote(selectedNoteId, normalizedTitle, contentDraft)
    }, 750)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [contentDraft, persistNote, selectedNote?.createdAt, selectedNoteId, selectedNoteSourceType, storageUnavailable, titleDraft])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        if (storageUnavailable) return
        event.preventDefault()
        void handleCreateNote({ title: getDefaultNoteTitle(), content: "" })
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        if (!selectedNoteId) return
        event.preventDefault()
        void persistNote(selectedNoteId, titleDraft, contentDraft)
      }
      if (!event.metaKey && !event.ctrlKey && event.key === "/") {
        const target = event.target as HTMLElement | null
        const isInputLike =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.getAttribute("contenteditable") === "true"
        if (isInputLike) return
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [contentDraft, handleCreateNote, persistNote, selectedNoteId, titleDraft, storageUnavailable])

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleArchiveToggle = React.useCallback(
    async (note: NoteRecord) => {
      if (getNoteSourceType(note) !== "note") return
      const nextArchived = !note.archived
      const result = await setNoteArchived(note.id, nextArchived)
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to update note")
        return
      }

      setNotes((current) => upsertNote(current, result.data as NoteRecord))
      if (selectedNoteId === note.id && nextArchived !== showArchived) {
        const fallback = notes.find(
          (candidate) => candidate.id !== note.id && candidate.archived === showArchived
        )
        setSelectedNoteId(fallback?.id ?? null)
      }
    },
    [notes, selectedNoteId, showArchived]
  )

  const handlePinToggle = React.useCallback(async (note: NoteRecord) => {
    if (getNoteSourceType(note) !== "note") return
    const result = await setNotePinned(note.id, !note.pinned)
    if (!result.success || !result.data) {
      toast.error(result.error || "Failed to update note")
      return
    }
    setNotes((current) => upsertNote(current, result.data as NoteRecord))
  }, [])

  const handleDelete = React.useCallback(
    async (note: NoteRecord) => {
      if (getNoteSourceType(note) !== "note") return
      const confirmed = window.confirm(`Delete note "${getNoteDisplayTitle(note)}"?`)
      if (!confirmed) return

      const result = await deleteNote(note.id)
      if (!result.success) {
        toast.error(result.error || "Failed to delete note")
        return
      }

      setNotes((current) => current.filter((item) => item.id !== note.id))
      if (selectedNoteId === note.id) {
        const fallback = notes.find((candidate) => candidate.id !== note.id && candidate.archived === showArchived)
        setSelectedNoteId(fallback?.id ?? null)
      }
    },
    [notes, selectedNoteId, showArchived]
  )

  const appendTemplate = React.useCallback(() => {
    if (selectedNoteSourceType === "project") {
      setContentDraft((current) => (current.trim() ? `${current}<p></p>${PROJECT_REQUIREMENTS_TEMPLATE}` : PROJECT_REQUIREMENTS_TEMPLATE))
      return
    }
    if (selectedNoteSourceType === "task") {
      setContentDraft((current) => (current.trim() ? `${current}<p></p>${TASK_NOTES_TEMPLATE}` : TASK_NOTES_TEMPLATE))
    }
  }, [selectedNoteSourceType])

  const renderNotesList = React.useCallback(
    (isMobile = false) => (
      <div className={cn("flex flex-col", isMobile ? "h-full" : "h-[calc(100vh-245px)] min-h-[420px]")}>
        <div className="border-b border-slate-100/90 bg-transparent px-2.5 py-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
            {showArchived ? "Archived notes" : "Active notes"} · {visibleNotes.length}
          </p>
        </div>
        <div className={cn("flex-1 space-y-1 overflow-y-auto", isMobile ? "p-2" : "p-2")}>
          {visibleNotes.map((note) => {
            const selected = note.id === selectedNoteId
            const sourceType = getNoteSourceType(note)
            const isLinked = sourceType !== "note"
            return (
              <div
                key={note.id}
                onClick={() => {
                  setSelectedNoteId(note.id)
                  if (isMobile) setIsMobileListOpen(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedNoteId(note.id)
                    if (isMobile) setIsMobileListOpen(false)
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "w-full rounded-[12px] border border-transparent px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_24%,white)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  selected
                    ? "bg-[color:color-mix(in_srgb,var(--brand-cyan)_10%,white)]"
                    : "bg-transparent hover:bg-slate-50/75"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-[13px] font-medium leading-5 text-[var(--text-primary)]">
                    {getNoteDisplayTitle(note)}
                  </p>
                  {isLinked ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      {sourceType === "project" ? <FolderKanban className="h-3 w-3" /> : <ListTodo className="h-3 w-3" />}
                      {sourceType}
                    </span>
                  ) : note.pinned ? (
                    <Pin className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.3rem] text-[var(--text-secondary)]">{getNotePreview(note)}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium text-[var(--text-muted)]">
                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                  </p>
                  {!isLinked ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void handlePinToggle(note)
                        }}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,white)]"
                        aria-label={note.pinned ? "Unpin note" : "Pin note"}
                      >
                        {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void handleArchiveToggle(note)
                        }}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,white)]"
                        aria-label={note.archived ? "Restore note" : "Archive note"}
                      >
                        {note.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void handleDelete(note)
                        }}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}

          {visibleNotes.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-slate-200/80 bg-slate-50/50 p-5 text-center">
              <p className="text-sm font-medium text-[var(--text-secondary)]">No notes in this view.</p>
            </div>
          ) : null}
        </div>
      </div>
    ),
    [handleArchiveToggle, handleDelete, handlePinToggle, selectedNoteId, showArchived, visibleNotes]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[26px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4 lg:p-5">
        <DashboardPageHeader
          title="Notes"
          showMobile
          search={
            <div className="flex items-center gap-2">
              <NotesSearchInput
                ref={searchRef}
                value={search}
                onChange={setSearch}
              />
              <Button
                type="button"
                variant={showArchived ? "default" : "outline"}
                className="h-10 rounded-xl"
                onClick={() => setShowArchived((current) => !current)}
                disabled={false}
              >
                {showArchived ? "Archived" : "Active"}
              </Button>
            </div>
          }
          mobileSearch={
            <NotesSearchInput
              ref={searchRef}
              value={search}
              onChange={setSearch}
            />
          }
          actions={
            <Button
              type="button"
              className="header-action-button"
              onClick={() => void handleCreateNote({ title: getDefaultNoteTitle(), content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="h-5 w-5 md:mr-1.5 md:h-4 md:w-4" />
              <span className="header-action-label">New Note</span>
            </Button>
          }
          mobileActions={
            <Button
              type="button"
              className="header-action-button !h-10 !w-auto !min-w-[132px] !rounded-[18px] !px-3.5 !gap-1.5"
              onClick={() => void handleCreateNote({ title: getDefaultNoteTitle(), content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="h-5 w-5 md:h-4 md:w-4" />
              <span className="inline text-sm font-semibold">Add</span>
            </Button>
          }
        />
      </div>

      <Card className="overflow-hidden rounded-[16px] border border-slate-200/70 bg-white shadow-[0_2px_6px_rgba(15,23,42,0.025)]">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[252px_minmax(0,1fr)]">
            <aside className="hidden border-r border-slate-100/90 bg-white md:block">
              {renderNotesList(false)}
            </aside>

            <section className="min-w-0 bg-white">
              <div className="border-b border-slate-100/90 px-3 py-2.5 sm:px-3.5 sm:py-2.5 md:hidden">
                <div className="inline-flex items-center gap-2">
                  <Sheet open={isMobileListOpen} onOpenChange={setIsMobileListOpen}>
                    <SheetTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl">
                        <NotebookPen className="mr-1.5 h-4 w-4" />
                        Notes ({visibleNotes.length})
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[86vw] border-r border-slate-100/90 p-0 sm:max-w-md">
                      <SheetHeader className="border-b border-slate-100/90 bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_78%,white)] px-4 py-2.5">
                        <SheetTitle>Notes</SheetTitle>
                      </SheetHeader>
                      {renderNotesList(true)}
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {selectedNote ? (
                <div className="space-y-2 p-3 sm:p-3.5 md:p-4">
                  {selectedNoteIsLinked ? (
                    <div className="flex items-center gap-2 px-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600">
                        {selectedNoteSourceType === "project" ? <FolderKanban className="h-3.5 w-3.5" /> : <ListTodo className="h-3.5 w-3.5" />}
                        {selectedNoteSourceType === "project" ? "Project note" : "Task note"}
                        {selectedNote.sourceLabel ? <span className="text-slate-400">• {selectedNote.sourceLabel}</span> : null}
                      </span>
                    </div>
                  ) : null}
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    readOnly={selectedNoteIsLinked}
                    placeholder={getDefaultNoteTitle(selectedNote.createdAt)}
                    className={cn(
                      "h-9 w-full rounded-md border-0 bg-transparent px-1 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0",
                      selectedNoteIsLinked && "cursor-default text-slate-700"
                    )}
                  />
                  <RichTextEditor
                    value={contentDraft}
                    onChange={setContentDraft}
                    placeholder="Write here..."
                    variant="plain"
                    mode="document"
                    documentLayout="left"
                    uploadProjectId={editorUploadContextId}
                    toolbarVisibility="always"
                    toolbarPreset="full"
                    toolbarActions={
                      selectedNoteIsLinked ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={appendTemplate}
                          className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Add template"
                          title="Add template"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      ) : undefined
                    }
                    className="rounded-[22px] bg-white [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-6"
                    minHeightClassName="min-h-[54vh] sm:min-h-[58vh] md:min-h-[60vh]"
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[9px] font-medium text-[var(--text-muted)]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>Created {format(new Date(selectedNote.createdAt), "dd.MM.yyyy")}</span>
                      <span className="text-slate-300">•</span>
                      <span>Updated {formatDistanceToNow(new Date(selectedNote.updatedAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 md:p-5">
                  <div className="flex min-h-[280px] items-start justify-start rounded-[16px] border border-dashed border-[var(--line-subtle)] bg-slate-50/60 p-5 sm:p-6">
                    <div className="max-w-md space-y-2.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                        <NotebookPen className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="space-y-1 text-left">
                        <p className="text-[15px] font-medium text-[var(--text-primary)]">Start a fresh note</p>
                        <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
                          New notes open with today&apos;s date as the title, so you can begin writing right away.
                        </p>
                      </div>
                      <div className="pt-1">
                        <Button
                          type="button"
                          className="h-10 rounded-xl"
                          onClick={() => void handleCreateNote({ title: getDefaultNoteTitle(), content: "" })}
                          disabled={isCreating}
                        >
                          <FilePlus2 className="mr-1.5 h-4 w-4" />
                          New note for today
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
