"use client"

import * as React from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Archive, ArchiveRestore, FilePlus2, NotebookPen, Pin, PinOff, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createNote, deleteNote, setNoteArchived, setNotePinned, updateNote, type NoteRecord } from "@/lib/actions/notes"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
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
        note.contentText.toLowerCase().includes(needle)
      )
    })
  }, [notes, search, showArchived])

  const persistNote = React.useCallback(
    async (noteId: string, titleValue: string, contentValue: string) => {
      const existingNote = notes.find((item) => item.id === noteId) ?? null
      const normalizedTitle = normalizeTitle(titleValue, existingNote?.createdAt)
      const snapshot = lastSyncedRef.current
      if (snapshot.id === noteId && snapshot.title === normalizedTitle && snapshot.content === contentValue) {
        return true
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
    [notes]
  )

  const handleCreateNote = React.useCallback(
    async (prefill?: { title?: string; content?: string }) => {
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
    []
  )

  React.useEffect(() => {
    if (storageUnavailable) return
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    if (notes.length === 0) {
      void handleCreateNote({ title: getDefaultNoteTitle(), content: "" })
    } else if (!selectedNoteId) {
      const firstActive = notes.find((note) => !note.archived) ?? notes[0]
      if (firstActive) setSelectedNoteId(firstActive.id)
    }
  }, [handleCreateNote, notes, selectedNoteId, storageUnavailable])

  React.useEffect(() => {
    if (storageUnavailable) return
    if (!selectedNoteId) return
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
  }, [contentDraft, persistNote, selectedNote?.createdAt, selectedNoteId, storageUnavailable, titleDraft])

  React.useEffect(() => {
    if (storageUnavailable) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
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

  const renderNotesList = React.useCallback(
    (isMobile = false) => (
      <div className={cn("flex flex-col", isMobile ? "h-full" : "h-[calc(100vh-250px)] min-h-[420px]")}>
        <div className="border-b border-[var(--line-subtle)] bg-slate-50/70 px-3 py-2.5">
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
                  "w-full rounded-[14px] border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_30%,white)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  selected
                    ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_42%,white)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_10%,white)]"
                    : "border-slate-200 bg-white hover:border-[var(--line-subtle)] hover:bg-slate-50/70"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">
                    {getNoteDisplayTitle(note)}
                  </p>
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
            <div className="rounded-[14px] border border-dashed border-[var(--line-subtle)] bg-slate-50/60 p-6 text-center">
              <p className="text-sm font-medium text-[var(--text-secondary)]">No notes in this view.</p>
            </div>
          ) : null}
        </div>
      </div>
    ),
    [handleArchiveToggle, handleDelete, handlePinToggle, selectedNoteId, showArchived, visibleNotes]
  )

  return (
    <div className="space-y-2.5">
      <DashboardPageHeader
        title="Notes"
        showMobile
        className="gap-2 lg:gap-3"
        search={
          <div className="flex items-center gap-2">
            <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[28px] border border-slate-200/90 bg-white/95 px-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
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
            <span className="inline text-sm font-semibold">Quick Add</span>
          </Button>
        }
      />

      <Card className="overflow-hidden rounded-[20px] border-[var(--line-subtle)] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="hidden border-r border-[var(--line-subtle)] bg-white md:block">
              {renderNotesList(false)}
            </aside>

            <section className="min-w-0 bg-white">
              <div className="border-b border-[var(--line-subtle)] px-3.5 py-2.5 sm:px-4 sm:py-3 md:hidden">
                <div className="inline-flex items-center gap-2">
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
              </div>

              {storageUnavailable ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-[var(--text-primary)]">Notes storage is not ready</p>
                  <p className="max-w-[680px] text-sm text-[var(--text-secondary)]">
                    Run <code>npx prisma generate</code> and <code>npx prisma migrate deploy</code>, then restart the app.
                  </p>
                </div>
              ) : selectedNote ? (
                <div className="space-y-3 p-3.5 sm:p-4 md:p-5">
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    placeholder={getDefaultNoteTitle(selectedNote.createdAt)}
                    className="h-10 rounded-xl border-[var(--line-subtle)] bg-[var(--bg-surface)] text-base font-semibold sm:h-11"
                  />
                  <RichTextEditor
                    value={contentDraft}
                    onChange={setContentDraft}
                    placeholder="Write here..."
                    variant="plain"
                    mode="panel"
                    toolbarVisibility="always"
                    toolbarPreset="minimal"
                    className="rounded-[16px] border border-[var(--line-subtle)] bg-white shadow-none"
                    minHeightClassName="min-h-[54vh] sm:min-h-[58vh] md:min-h-[60vh]"
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10px] font-medium text-[var(--text-muted)]">
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
                      <div className="space-y-1.5 text-left">
                        <p className="text-base font-semibold text-[var(--text-primary)]">Start a fresh note</p>
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">
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
