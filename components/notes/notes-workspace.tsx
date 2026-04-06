"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Archive, ArchiveRestore, FilePlus2, NotebookPen, Pin, PinOff, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createNote, deleteNote, setNoteArchived, setNotePinned, updateNote, type NoteRecord } from "@/lib/actions/notes"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type NotesWorkspaceProps = {
  initialNotes: NoteRecord[]
  initialSelectedNoteId: string | null
  storageUnavailable?: boolean
}

type SaveState = "idle" | "typing" | "saving" | "saved" | "error"

function normalizeTitle(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "Untitled"
}

function getNotePreview(note: NoteRecord) {
  const source = note.contentText || note.content || ""
  const compact = source.replace(/\s+/g, " ").trim()
  if (!compact) return "No content yet"
  if (compact.length <= 80) return compact
  return `${compact.slice(0, 80)}...`
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

function saveStateLabel(state: SaveState) {
  if (state === "typing") return "Typing..."
  if (state === "saving") return "Saving..."
  if (state === "saved") return "Saved"
  if (state === "error") return "Save failed"
  return "Ready"
}

function saveStateClass(state: SaveState) {
  if (state === "saving") return "text-blue-600"
  if (state === "saved") return "text-emerald-600"
  if (state === "typing") return "text-amber-600"
  if (state === "error") return "text-rose-600"
  return "text-slate-500"
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
  const [saveState, setSaveState] = React.useState<SaveState>("idle")

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

  React.useEffect(() => {
    if (!selectedNote) {
      setTitleDraft("")
      setContentDraft("")
      lastSyncedRef.current = { id: null, title: "", content: "" }
      setSaveState("idle")
      return
    }

    setTitleDraft(selectedNote.title || "Untitled")
    setContentDraft(selectedNote.content || "")
    lastSyncedRef.current = {
      id: selectedNote.id,
      title: selectedNote.title || "Untitled",
      content: selectedNote.content || "",
    }
    setSaveState("idle")
  }, [selectedNote])

  const visibleNotes = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    return notes.filter((note) => {
      if (note.archived !== showArchived) return false
      if (!needle) return true
      return (
        note.title.toLowerCase().includes(needle) ||
        note.contentText.toLowerCase().includes(needle)
      )
    })
  }, [notes, search, showArchived])

  const persistNote = React.useCallback(
    async (noteId: string, titleValue: string, contentValue: string, silent = false) => {
      const normalizedTitle = normalizeTitle(titleValue)
      const snapshot = lastSyncedRef.current
      if (snapshot.id === noteId && snapshot.title === normalizedTitle && snapshot.content === contentValue) {
        if (!silent) setSaveState("saved")
        return true
      }

      if (!silent) setSaveState("saving")
      const result = await updateNote(noteId, {
        title: normalizedTitle,
        content: contentValue,
      })

      if (!result.success || !result.data) {
        if (!silent) {
          setSaveState("error")
          toast.error(result.error || "Failed to save note")
        }
        return false
      }

      setNotes((current) => upsertNote(current, result.data as NoteRecord))
      lastSyncedRef.current = {
        id: result.data.id,
        title: result.data.title,
        content: result.data.content,
      }
      if (!silent) setSaveState("saved")
      return true
    },
    []
  )

  const handleCreateNote = React.useCallback(
    async (prefill?: { title?: string; content?: string }) => {
      setIsCreating(true)
      try {
        const result = await createNote({
          title: normalizeTitle(prefill?.title || ""),
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
    []
  )

  React.useEffect(() => {
    if (storageUnavailable) return
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    if (notes.length === 0) {
      void handleCreateNote({ title: "", content: "" })
    } else if (!selectedNoteId) {
      const firstActive = notes.find((note) => !note.archived) ?? notes[0]
      if (firstActive) setSelectedNoteId(firstActive.id)
    }
  }, [handleCreateNote, notes, selectedNoteId, storageUnavailable])

  React.useEffect(() => {
    if (storageUnavailable) return
    if (!selectedNoteId) return
    const normalizedTitle = normalizeTitle(titleDraft)
    const currentSnapshot = lastSyncedRef.current
    if (
      currentSnapshot.id === selectedNoteId &&
      currentSnapshot.title === normalizedTitle &&
      currentSnapshot.content === contentDraft
    ) {
      return
    }

    setSaveState("typing")
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistNote(selectedNoteId, normalizedTitle, contentDraft)
    }, 750)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [contentDraft, persistNote, selectedNoteId, titleDraft, storageUnavailable])

  React.useEffect(() => {
    if (storageUnavailable) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault()
        void handleCreateNote({ title: "", content: "" })
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
    const result = await setNotePinned(note.id, !note.pinned)
    if (!result.success || !result.data) {
      toast.error(result.error || "Failed to update note")
      return
    }
    setNotes((current) => upsertNote(current, result.data as NoteRecord))
  }, [])

  const handleDelete = React.useCallback(
    async (note: NoteRecord) => {
      const confirmed = window.confirm(`Delete note "${note.title}"?`)
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

  const renderNotesList = React.useCallback(
    (isMobile = false) => (
      <div className={cn("flex flex-col", isMobile ? "h-full" : "h-[calc(100vh-260px)] min-h-[420px]")}>
        <div className="border-b border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_78%,white)] px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {showArchived ? "Archived notes" : "Active notes"} · {visibleNotes.length}
          </p>
        </div>
        <div className={cn("flex-1 space-y-1.5 overflow-y-auto", isMobile ? "p-2.5" : "p-2.5")}>
          {visibleNotes.map((note) => {
            const selected = note.id === selectedNoteId
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
                  "w-full rounded-[18px] border px-3.5 py-2.5 text-left transition-colors shadow-[0_2px_10px_rgba(15,23,42,0.02)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_30%,white)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  selected
                    ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_45%,white)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--brand-cyan)_12%,white),color-mix(in_srgb,var(--brand-cyan)_7%,white))]"
                    : "border-slate-200/70 bg-white/80 hover:border-[var(--line-subtle)] hover:bg-[var(--bg-surface-soft)]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{note.title}</p>
                  {note.pinned ? <Pin className="mt-0.5 h-3.5 w-3.5 text-amber-500" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{getNotePreview(note)}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void handlePinToggle(note)
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,white)]"
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
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,white)]"
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
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {visibleNotes.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.88))] p-6 text-center">
              <p className="text-sm font-medium text-[var(--text-secondary)]">No notes in this view.</p>
            </div>
          ) : null}
        </div>
      </div>
    ),
    [handleArchiveToggle, handleDelete, handlePinToggle, selectedNoteId, showArchived, visibleNotes]
  )

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
        <DashboardPageHeader
          title="Notes"
          showMobile
          search={
            <div className="flex items-center gap-2">
              <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[var(--line-subtle)] bg-white/95 px-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                <Search className="h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notes..."
                  className="h-8 w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                />
              </div>
              <Button
                type="button"
                variant={showArchived ? "default" : "outline"}
                className="h-10 rounded-xl"
                onClick={() => setShowArchived((current) => !current)}
                disabled={storageUnavailable}
              >
                {showArchived ? "Archived" : "Active"}
              </Button>
            </div>
          }
          actions={
            <Button
              type="button"
              className="h-10 rounded-xl"
              onClick={() => void handleCreateNote({ title: "", content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="mr-2 h-4 w-4" />
              New note
            </Button>
          }
          mobileActions={
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => void handleCreateNote({ title: "", content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              New
            </Button>
          }
        />
      </div>

      <Card className="overflow-hidden rounded-[24px] border-[var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="hidden border-r border-[var(--line-subtle)] bg-[var(--bg-surface)] md:block">
              {renderNotesList(false)}
            </aside>

            <section className="min-w-0 bg-white">
              <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3.5 py-2.5 sm:px-4 sm:py-3">
                <div className="inline-flex items-center gap-2 md:hidden">
                  <Sheet open={isMobileListOpen} onOpenChange={setIsMobileListOpen}>
                    <SheetTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl">
                        <NotebookPen className="mr-1.5 h-4 w-4" />
                        Notes ({visibleNotes.length})
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[86vw] border-r border-[var(--line-subtle)] p-0 sm:max-w-md">
                      <SheetHeader className="border-b border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_78%,white)] px-4 py-3">
                        <SheetTitle>Notes</SheetTitle>
                      </SheetHeader>
                      {renderNotesList(true)}
                    </SheetContent>
                  </Sheet>
                </div>

                <p className={cn("text-xs font-semibold uppercase tracking-[0.08em]", saveStateClass(saveState))}>
                  {saveStateLabel(saveState)}
                </p>
              </div>

              {storageUnavailable ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-[var(--text-primary)]">Notes storage is not ready</p>
                  <p className="max-w-[680px] text-sm text-[var(--text-secondary)]">
                    Run <code>npx prisma generate</code> and <code>npx prisma migrate deploy</code>, then restart the app.
                  </p>
                </div>
              ) : selectedNote ? (
                <div className="space-y-2.5 p-3.5 sm:p-4 md:p-5">
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    placeholder="Untitled"
                    className="h-10 rounded-xl border-[var(--line-subtle)] bg-[var(--bg-surface)] text-base font-semibold sm:h-11"
                  />
                  <Textarea
                    value={contentDraft}
                    onChange={(event) => setContentDraft(event.target.value)}
                    placeholder="Write your note here..."
                    className="min-h-[54vh] rounded-[20px] border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3.5 text-sm leading-6 sm:min-h-[58vh] sm:p-4 md:min-h-[60vh]"
                  />
                </div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                    <NotebookPen className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-base font-semibold text-[var(--text-primary)]">No note selected</p>
                  <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">Create a new note and start writing instantly.</p>
                  <Button
                    type="button"
                    className="h-10 rounded-xl"
                    onClick={() => void handleCreateNote({ title: "", content: "" })}
                    disabled={isCreating}
                  >
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Create note
                  </Button>
                </div>
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
