"use client"

import * as React from "react"
import { format, formatDistanceToNow, isToday } from "date-fns"
import { Archive, ArchiveRestore, Check, ChevronRight, FilePlus2, Folder, FolderKanban, FolderPlus, ListTodo, NotebookPen, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { createNote, createNoteFolder, deleteNote, deleteNoteFolder, renameNoteFolder, setNoteArchived, setNotePinned, updateNote, type NoteFolderRecord, type NoteRecord } from "@/lib/actions/notes"
import { updateProject } from "@/lib/actions/projects"
import { updateTask } from "@/lib/actions/tasks"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { NotesSearchInput } from "@/components/notes/notes-search-input"
import { cn } from "@/lib/utils"
import {
  DEFAULT_NOTE_PREVIEW,
  DEFAULT_NOTE_TITLE,
  deriveNoteTitleFromContent,
  derivePreviewBodyFromContent,
} from "@/lib/notes/derived-note-text"

type NotesWorkspaceProps = {
  initialNotes: NoteRecord[]
  initialSelectedNoteId: string | null
  initialFolders: NoteFolderRecord[]
  foldersEnabled?: boolean
  storageUnavailable?: boolean
}

type NoteSection = {
  key: string
  label: string
  notes: NoteRecord[]
}

const COLLAPSIBLE_NOTE_SECTION_KEYS = new Set(["projects", "tasks"])
const NO_FOLDER_VALUE = "__none__"

function getFolderIdFromSectionKey(sectionKey: string) {
  if (!sectionKey.startsWith("folder:")) return null
  return sectionKey.slice("folder:".length) || null
}

function getNoteDisplayTitle(note: NoteRecord) {
  if (getNoteSourceType(note) !== "note") return note.title?.trim() || DEFAULT_NOTE_TITLE
  return deriveNoteTitleFromContent(note.content || note.contentText || "", note.title || DEFAULT_NOTE_TITLE)
}

function getNotePreview(note: NoteRecord) {
  if (getNoteSourceType(note) !== "note") {
    const compact = (note.contentText || "").replace(/\s+/g, " ").trim()
    if (!compact) return DEFAULT_NOTE_PREVIEW
    return compact.length <= 80 ? compact : `${compact.slice(0, 80)}...`
  }
  const body = derivePreviewBodyFromContent(note.content || note.contentText || "", DEFAULT_NOTE_PREVIEW)
  return body.length <= 80 ? body : `${body.slice(0, 80)}...`
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

function scoreSearchMatch(note: NoteRecord, needle: string) {
  if (!needle) return 0
  const title = getNoteDisplayTitle(note).toLowerCase()
  const preview = getNotePreview(note).toLowerCase()
  const label = (note.sourceLabel || "").toLowerCase()

  let score = 0
  if (title === needle) score += 120
  else if (title.startsWith(needle)) score += 90
  else if (title.includes(needle)) score += 70
  if (preview.includes(needle)) score += 35
  if (label.includes(needle)) score += 15
  return score
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

function buildVisibleNoteSections(
  items: NoteRecord[],
  folders: NoteFolderRecord[],
  showArchived: boolean,
  foldersEnabled: boolean
) {
  if (showArchived) {
    return items.length ? [{ key: "archived", label: "Archived", notes: items }] : []
  }

  const pinned = items.filter((note) => getNoteSourceType(note) === "note" && note.pinned)
  const personalUnpinned = items.filter(
    (note) =>
      getNoteSourceType(note) === "note" &&
      !note.pinned
  )
  const unfiled = foldersEnabled ? personalUnpinned.filter((note) => !note.folderId) : personalUnpinned
  const projectNotes = items.filter((note) => getNoteSourceType(note) === "project")
  const taskNotes = items.filter((note) => getNoteSourceType(note) === "task")

  const folderSections = foldersEnabled
    ? folders.map((folder) => ({
    key: `folder:${folder.id}`,
    label: folder.name,
    notes: personalUnpinned.filter((note) => note.folderId === folder.id),
    }))
    : []

  const personalByDay = unfiled.reduce(
    (acc, note) => {
      if (isToday(new Date(note.updatedAt))) acc.today.push(note)
      else acc.earlier.push(note)
      return acc
    },
    { today: [] as NoteRecord[], earlier: [] as NoteRecord[] }
  )

  const sections = [
    { key: "pinned", label: "Pinned", notes: pinned },
    ...folderSections,
    { key: "today", label: "Today", notes: personalByDay.today },
    { key: "earlier", label: "Earlier", notes: personalByDay.earlier },
    { key: "projects", label: "Project Notes", notes: projectNotes },
    { key: "tasks", label: "Task Notes", notes: taskNotes },
  ]

  return sections.filter((section) => section.notes.length > 0 || section.key.startsWith("folder:"))
}

export function NotesWorkspace({
  initialNotes,
  initialSelectedNoteId,
  initialFolders,
  foldersEnabled = true,
  storageUnavailable = false,
}: NotesWorkspaceProps) {
  const [notes, setNotes] = React.useState<NoteRecord[]>(() => sortNotes(initialNotes))
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(initialSelectedNoteId)
  const [contentDraft, setContentDraft] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [showArchived, setShowArchived] = React.useState(false)
  const [isMobileListOpen, setIsMobileListOpen] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [pendingDeleteNote, setPendingDeleteNote] = React.useState<NoteRecord | null>(null)
  const [isDeletingNote, setIsDeletingNote] = React.useState(false)
  const [editorFocusToken, setEditorFocusToken] = React.useState(0)
  const [folders, setFolders] = React.useState<NoteFolderRecord[]>(initialFolders)
  const [isAddingFolder, setIsAddingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false)
  const [editingFolderId, setEditingFolderId] = React.useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = React.useState("")
  const [isRenamingFolder, setIsRenamingFolder] = React.useState(false)
  const [pendingDeleteFolder, setPendingDeleteFolder] = React.useState<NoteFolderRecord | null>(null)
  const [isDeletingFolder, setIsDeletingFolder] = React.useState(false)
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({
    projects: true,
    tasks: true,
  })
  const [touchFolderMenuId, setTouchFolderMenuId] = React.useState<string | null>(null)

  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const folderLongPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderLongPressTriggeredRef = React.useRef(false)
  const folderLongPressIdRef = React.useRef<string | null>(null)
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
    setCollapsedSections((current) => {
      const next = { ...current }
      for (const folder of folders) {
        const key = `folder:${folder.id}`
        if (next[key] === undefined) next[key] = false
      }
      return next
    })
  }, [folders])
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
      setContentDraft("")
      lastSyncedRef.current = { id: null, title: "", content: "" }
      return
    }

    const normalizedContent = normalizeNoteContentForEditor(selectedNote.content || "")
    setContentDraft(normalizedContent)
    lastSyncedRef.current = {
      id: selectedNote.id,
      title:
        selectedNoteSourceType === "note"
          ? deriveNoteTitleFromContent(normalizedContent, selectedNote.title || DEFAULT_NOTE_TITLE)
          : selectedNote.title,
      content: normalizedContent,
    }
  }, [selectedNote, selectedNoteSourceType])

  const visibleNotes = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = notes.filter((note) => {
      if (note.archived !== showArchived) return false
      if (!needle) return true
      return (
        getNoteDisplayTitle(note).toLowerCase().includes(needle) ||
        getNotePreview(note).toLowerCase().includes(needle) ||
        (note.sourceLabel || "").toLowerCase().includes(needle)
      )
    })

    if (!needle) return filtered

    return [...filtered].sort((a, b) => {
      const scoreDiff = scoreSearchMatch(b, needle) - scoreSearchMatch(a, needle)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [notes, search, showArchived])

  const visibleSections = React.useMemo<NoteSection[]>(
    () => buildVisibleNoteSections(visibleNotes, folders, showArchived, foldersEnabled),
    [folders, foldersEnabled, showArchived, visibleNotes]
  )
  const defaultFolder = React.useMemo(
    () => folders.find((folder) => folder.isDefault) ?? null,
    [folders]
  )
  const searchQuery = search.trim()
  const hasSearchQuery = searchQuery.length > 0

  const persistNote = React.useCallback(
    async (noteId: string, contentValue: string) => {
      const existingNote = notes.find((item) => item.id === noteId) ?? null
      if (!existingNote) return false
      const sourceType = getNoteSourceType(existingNote)
      const normalizedTitle =
        sourceType === "note"
          ? deriveNoteTitleFromContent(contentValue, existingNote.title || DEFAULT_NOTE_TITLE)
          : existingNote.title
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
    async (prefill?: { content?: string }) => {
      if (storageUnavailable) {
        toast.error("Notes storage is not ready yet")
        return null
      }
      setIsCreating(true)
      try {
        const result = await createNote({
          content: prefill?.content || "",
        })
        if (!result.success || !result.data) {
          toast.error(result.error || "Failed to create note")
          return null
        }

        setNotes((current) => upsertNote(current, result.data as NoteRecord))
        setShowArchived(false)
        setSelectedNoteId(result.data.id)
        setEditorFocusToken((current) => current + 1)
        setIsMobileListOpen(false)
        return result.data.id
      } finally {
        setIsCreating(false)
      }
    },
    [storageUnavailable]
  )

  const handleCreateFolder = React.useCallback(async () => {
    const name = newFolderName.trim()
    if (!name) {
      toast.error("Folder name is required")
      return
    }
    setIsCreatingFolder(true)
    try {
      const result = await createNoteFolder({ name })
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to create folder")
        return
      }
      setFolders((current) => {
        const exists = current.some((folder) => folder.id === result.data.id)
        if (exists) return current
        return [...current, result.data].sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      })
      setNewFolderName("")
      setIsAddingFolder(false)
      toast.success("Folder created")
    } finally {
      setIsCreatingFolder(false)
    }
  }, [newFolderName])

  const startRenameFolder = React.useCallback((folder: NoteFolderRecord) => {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
  }, [])

  const cancelRenameFolder = React.useCallback(() => {
    setEditingFolderId(null)
    setEditingFolderName("")
  }, [])

  const commitRenameFolder = React.useCallback(async () => {
    if (!editingFolderId) return
    const nextName = editingFolderName.trim()
    if (!nextName) {
      toast.error("Folder name is required")
      return
    }

    setIsRenamingFolder(true)
    try {
      const result = await renameNoteFolder(editingFolderId, { name: nextName })
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to rename folder")
        return
      }

      setFolders((current) =>
        current
          .map((folder) => (folder.id === result.data.id ? result.data : folder))
          .sort((a, b) => {
            if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
            return a.name.localeCompare(b.name)
          })
      )
      setNotes((current) =>
        current.map((note) =>
          getNoteSourceType(note) === "note" && note.folderId === result.data.id
            ? { ...note, folderName: result.data.name }
            : note
        )
      )
      setEditingFolderId(null)
      setEditingFolderName("")
      toast.success("Folder renamed")
    } finally {
      setIsRenamingFolder(false)
    }
  }, [editingFolderId, editingFolderName])

  const confirmDeleteFolder = React.useCallback(async () => {
    if (!pendingDeleteFolder) return
    setIsDeletingFolder(true)
    try {
      const result = await deleteNoteFolder(pendingDeleteFolder.id)
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to delete folder")
        return
      }

      setFolders((current) => current.filter((folder) => folder.id !== pendingDeleteFolder.id))
      setNotes((current) =>
        current.map((note) =>
          getNoteSourceType(note) === "note" && note.folderId === result.data.deletedFolderId
            ? {
                ...note,
                folderId: result.data.defaultFolderId,
                folderName: result.data.defaultFolderName,
              }
            : note
        )
      )
      setPendingDeleteFolder(null)
      toast.success(`Folder deleted. Notes moved to ${result.data.defaultFolderName}.`)
    } finally {
      setIsDeletingFolder(false)
    }
  }, [pendingDeleteFolder])

  const handleAssignFolder = React.useCallback(
    async (note: NoteRecord, folderId: string | null) => {
      if (!foldersEnabled) return
      if (getNoteSourceType(note) !== "note") return
      if (note.folderId === folderId) return

      const previousFolderId = note.folderId ?? null
      const previousFolderName = note.folderName ?? null
      const nextFolderName =
        folderId === null
          ? "Unfiled"
          : folders.find((folder) => folder.id === folderId)?.name || "Folder"

      setNotes((current) =>
        current.map((item) =>
          item.id === note.id
            ? {
                ...item,
                folderId,
                folderName: nextFolderName,
              }
            : item
        )
      )

      const result = await updateNote(note.id, { folderId })
      if (!result.success || !result.data) {
        setNotes((current) =>
          current.map((item) =>
            item.id === note.id
              ? {
                  ...item,
                  folderId: previousFolderId,
                  folderName: previousFolderName,
                }
              : item
          )
        )
        toast.error(result.error || "Failed to move note")
        return
      }
      setNotes((current) => upsertNote(current, result.data as NoteRecord))
      toast.success(`Moved to ${nextFolderName}`)
    },
    [folders, foldersEnabled]
  )

  React.useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    if (notes.length === 0 && !storageUnavailable) {
      void handleCreateNote({ content: "" })
    } else if (!selectedNoteId) {
      const firstActive = notes.find((note) => !note.archived) ?? notes[0]
      if (firstActive) setSelectedNoteId(firstActive.id)
    }
  }, [handleCreateNote, notes, selectedNoteId, storageUnavailable])

  React.useEffect(() => {
    if (!selectedNoteId) return
    if (selectedNoteSourceType === "note" && storageUnavailable) return
    const normalizedTitle =
      selectedNoteSourceType === "note"
        ? deriveNoteTitleFromContent(contentDraft, selectedNote?.title || DEFAULT_NOTE_TITLE)
        : selectedNote?.title || DEFAULT_NOTE_TITLE
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
      void persistNote(selectedNoteId, contentDraft)
    }, 750)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [contentDraft, persistNote, selectedNote?.title, selectedNoteId, selectedNoteSourceType, storageUnavailable])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        if (storageUnavailable) return
        event.preventDefault()
        void handleCreateNote({ content: "" })
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        if (!selectedNoteId) return
        event.preventDefault()
        void persistNote(selectedNoteId, contentDraft)
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
  }, [contentDraft, handleCreateNote, persistNote, selectedNoteId, storageUnavailable])

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (folderLongPressTimerRef.current) clearTimeout(folderLongPressTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (!touchFolderMenuId) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest("[data-touch-folder-menu='true']")) return
      if (target.closest(`[data-folder-row-id='${touchFolderMenuId}']`)) return
      setTouchFolderMenuId(null)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [touchFolderMenuId])

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

      setPendingDeleteNote(note)
    },
    []
  )

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteNote) return

    setIsDeletingNote(true)
    try {
      const result = await deleteNote(pendingDeleteNote.id)
      if (!result.success) {
        toast.error(result.error || "Failed to delete note")
        return
      }

      setNotes((current) => current.filter((item) => item.id !== pendingDeleteNote.id))
      if (selectedNoteId === pendingDeleteNote.id) {
        const fallback = notes.find(
          (candidate) =>
            candidate.id !== pendingDeleteNote.id && candidate.archived === showArchived
        )
        setSelectedNoteId(fallback?.id ?? null)
      }
      setPendingDeleteNote(null)
    } finally {
      setIsDeletingNote(false)
    }
  }, [notes, pendingDeleteNote, selectedNoteId, showArchived])

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
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          isMobile
            ? "bg-[var(--surface-lowest)]"
            : "bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_84%,var(--bg-surface)_16%)]"
        )}
      >
        <div
          className={cn(
            "group/notes-head sticky top-0 z-10 border-b border-[var(--line-subtle)] px-3 py-2 backdrop-blur-sm",
            isMobile
              ? "bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,transparent)]"
              : "bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_92%,var(--bg-surface)_8%)]/95"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
                {showArchived ? "Archived" : "All notes"}
              </p>
              <span className="text-[11px] font-medium tabular-nums text-[var(--text-muted)]">{visibleNotes.length}</span>
            </div>
            {!showArchived && foldersEnabled ? (
              <div className="flex items-center gap-1.5 transition-opacity duration-150 md:opacity-0 md:group-hover/notes-head:opacity-100 md:group-focus-within/notes-head:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-xl border-[var(--line-subtle)]/80 bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,transparent)] text-[var(--text-secondary)] shadow-none hover:bg-[var(--surface-low)]"
                  onClick={() => setIsAddingFolder((current) => !current)}
                  disabled={isCreatingFolder || storageUnavailable}
                  aria-label="Add folder"
                  title="Add folder"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-xl border-[var(--line-subtle)]/80 bg-[color:color-mix(in_srgb,var(--surface-lowest)_96%,transparent)] text-[var(--text-secondary)] shadow-none hover:bg-[var(--surface-low)]"
                  onClick={() => void handleCreateNote({ content: "" })}
                  disabled={isCreating || storageUnavailable}
                  aria-label="Quick add note"
                  title="Quick add note"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
          {isAddingFolder && !showArchived && foldersEnabled ? (
            <div className="mt-2 flex items-center gap-1.5">
              <Input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleCreateFolder()
                  }
                }}
                placeholder="Folder name"
                className="h-8 rounded-lg border-[var(--line-subtle)]/80 bg-[color:color-mix(in_srgb,var(--surface-lowest)_97%,transparent)] text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-xs shadow-none"
                onClick={() => void handleCreateFolder()}
                disabled={isCreatingFolder || storageUnavailable}
              >
                Add
              </Button>
            </div>
          ) : null}
        </div>
        <div className={cn("ui-scrollbar ui-scrollbar-inset mr-1 flex-1 overflow-y-auto", isMobile ? "p-2.5 pr-2" : "px-2.5 pb-2 pt-1.5 pr-2")}>
          {visibleSections.length > 0 ? (
            <div className="space-y-1.5">
              {visibleSections.map((section) => (
                <div key={section.key} className="group/section space-y-0.5">
                  {(() => {
                    const isFolderSection = foldersEnabled && section.key.startsWith("folder:")
                    const folderId = isFolderSection ? getFolderIdFromSectionKey(section.key) : null
                    const folder = folderId ? folders.find((item) => item.id === folderId) ?? null : null
                    const isDefaultFolder = Boolean(folder?.isDefault)
                    const isEditingThisFolder = Boolean(folder && editingFolderId === folder.id)
                    const isCollapsibleSection = COLLAPSIBLE_NOTE_SECTION_KEYS.has(section.key) || isFolderSection
                    const isCollapsed = Boolean(collapsedSections[section.key])
                    const rowIcon = <Folder className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />

                    return isCollapsibleSection ? (
                    <div className="relative">
                      <button
                        type="button"
                        data-folder-row-id={folder?.id}
                        className="group/folder-row relative grid min-h-10 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--surface-low)_26%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,transparent)]"
                        onClick={(event) => {
                          if (
                            folder &&
                            folderLongPressTriggeredRef.current &&
                            folderLongPressIdRef.current === folder.id
                          ) {
                            event.preventDefault()
                            event.stopPropagation()
                            folderLongPressTriggeredRef.current = false
                            return
                          }
                          if (folder && touchFolderMenuId === folder.id) {
                            setTouchFolderMenuId(null)
                            return
                          }
                          setCollapsedSections((current) => ({
                            ...current,
                            [section.key]: !current[section.key],
                          }))
                        }}
                        onPointerDown={(event) => {
                          if (!folder || event.pointerType === "mouse") return
                          folderLongPressTriggeredRef.current = false
                          folderLongPressIdRef.current = folder.id
                          if (folderLongPressTimerRef.current) {
                            clearTimeout(folderLongPressTimerRef.current)
                          }
                          folderLongPressTimerRef.current = setTimeout(() => {
                            folderLongPressTriggeredRef.current = true
                            setTouchFolderMenuId(folder.id)
                          }, 450)
                        }}
                        onPointerUp={() => {
                          if (folderLongPressTimerRef.current) {
                            clearTimeout(folderLongPressTimerRef.current)
                            folderLongPressTimerRef.current = null
                          }
                        }}
                        onPointerLeave={() => {
                          if (folderLongPressTimerRef.current) {
                            clearTimeout(folderLongPressTimerRef.current)
                            folderLongPressTimerRef.current = null
                          }
                        }}
                        onPointerCancel={() => {
                          if (folderLongPressTimerRef.current) {
                            clearTimeout(folderLongPressTimerRef.current)
                            folderLongPressTimerRef.current = null
                          }
                        }}
                        aria-expanded={!collapsedSections[section.key]}
                      >
                        <div className="flex min-w-0 items-start gap-1.5">
                          {rowIcon}
                          {isEditingThisFolder ? (
                            <Input
                              value={editingFolderName}
                              onChange={(event) => setEditingFolderName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  void commitRenameFolder()
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  cancelRenameFolder()
                                }
                              }}
                              onClick={(event) => event.stopPropagation()}
                              className="h-7 min-w-0 rounded-md border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-[11px]"
                              autoFocus
                            />
                          ) : (
                            <p className="min-w-0 whitespace-normal break-words text-[12px] font-medium leading-5 text-[var(--text-secondary)] line-clamp-2">
                              {section.label}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex h-6 min-w-7 shrink-0 items-center justify-end px-0.5 text-right text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                          {section.notes.length}
                        </span>
                        <ChevronRight
                          className={cn(
                            "h-[17px] w-[17px] shrink-0 justify-self-end text-[var(--text-muted)] transition-all duration-200 md:group-hover/section:opacity-0 md:group-focus-within/section:opacity-0",
                            isCollapsed ? "rotate-0" : "rotate-90"
                          )}
                        />
                      </button>
                      {isFolderSection && folder ? (
                        <div className="pointer-events-none absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,transparent)] px-1 py-0.5 opacity-0 shadow-[0_6px_16px_-14px_rgba(15,23,42,0.4)] transition-all duration-150 md:flex md:translate-x-1 md:scale-95 md:group-hover/section:pointer-events-auto md:group-hover/section:translate-x-0 md:group-hover/section:scale-100 md:group-hover/section:opacity-100 md:group-focus-within/section:pointer-events-auto md:group-focus-within/section:translate-x-0 md:group-focus-within/section:scale-100 md:group-focus-within/section:opacity-100">
                          {isEditingThisFolder ? (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  void commitRenameFolder()
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)]/55 hover:text-[var(--text-primary)]"
                                aria-label="Save folder name"
                                title="Save folder name"
                                disabled={isRenamingFolder}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  cancelRenameFolder()
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)]/55 hover:text-[var(--text-primary)]"
                                aria-label="Cancel folder rename"
                                title="Cancel folder rename"
                                disabled={isRenamingFolder}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  startRenameFolder(folder)
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)]/55 hover:text-[var(--text-primary)]"
                                aria-label="Rename folder"
                                title="Rename folder"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {!isDefaultFolder ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setPendingDeleteFolder(folder)
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500/90 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                  aria-label="Delete folder"
                                  title="Delete folder"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                      {isFolderSection && folder && touchFolderMenuId === folder.id ? (
                        <div
                          data-touch-folder-menu="true"
                          className="absolute right-1 top-[calc(100%+2px)] z-20 w-44 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl md:hidden"
                        >
                          <button
                            type="button"
                            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)]"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              startRenameFolder(folder)
                              setTouchFolderMenuId(null)
                            }}
                          >
                            Rename folder
                          </button>
                          {!isDefaultFolder ? (
                            <button
                              type="button"
                              className="mt-0.5 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                setPendingDeleteFolder(folder)
                                setTouchFolderMenuId(null)
                              }}
                            >
                              Delete folder
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid min-h-10 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-[color:color-mix(in_srgb,var(--surface-low)_26%,transparent)]">
                      <div className="flex min-w-0 items-start gap-1.5">
                        {rowIcon}
                        <p className="min-w-0 whitespace-normal break-words text-[12px] font-medium leading-5 text-[var(--text-secondary)] line-clamp-2">
                          {section.label}
                        </p>
                      </div>
                      <span className="inline-flex h-6 min-w-7 shrink-0 items-center justify-end px-0.5 text-right text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                        {section.notes.length}
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 justify-self-end text-[var(--text-muted)] transition-transform duration-200",
                          Boolean(collapsedSections[section.key]) ? "rotate-0" : "rotate-90"
                        )}
                      />
                    </div>
                  )
                  })()}
                  {(() => {
                    const isFolderSection = foldersEnabled && section.key.startsWith("folder:")
                    const isCollapsibleSection = COLLAPSIBLE_NOTE_SECTION_KEYS.has(section.key) || isFolderSection
                    const isCollapsed = Boolean(collapsedSections[section.key])
                    const shouldRenderNotes = !isCollapsibleSection || !isCollapsed
                    return shouldRenderNotes ? (
                    <div className="space-y-1">
                      {section.notes.map((note) => {
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
                            "group relative w-full overflow-hidden rounded-[16px] border px-3 py-2.5 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_24%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-lowest)]",
                            selected
                              ? "translate-x-[1px] border-[color:color-mix(in_srgb,var(--brand-cyan)_28%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_14%,var(--surface-lowest))] shadow-[0_12px_28px_-22px_rgba(15,23,42,0.42)]"
                              : "border-transparent bg-[color:color-mix(in_srgb,var(--surface-lowest)_86%,var(--surface-low)_14%)] hover:-translate-y-[1px] hover:border-[var(--line-subtle)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_76%,var(--surface-low)_24%)] hover:shadow-[0_10px_22px_-24px_rgba(15,23,42,0.35)]"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-2 left-0 w-[3px] rounded-full transition-all duration-200",
                              selected ? "bg-[var(--brand-cyan)] opacity-100" : "bg-transparent opacity-0"
                            )}
                          />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 text-[13px] font-semibold leading-5 text-[var(--text-primary)]">
                                {getNoteDisplayTitle(note)}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.35rem] text-[var(--text-secondary)]">
                                {getNotePreview(note)}
                              </p>
                            </div>
                            {!isLinked && note.pinned ? (
                              <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                              <span className="truncate">
                                {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                              </span>
                              {isLinked ? (
                                <>
                                  <span className="text-[var(--text-muted)]">•</span>
                                  <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[var(--text-secondary)] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]">
                                    {sourceType === "project" ? (
                                      <FolderKanban className="h-3 w-3 shrink-0" />
                                    ) : (
                                      <ListTodo className="h-3 w-3 shrink-0" />
                                    )}
                                    <span className="truncate normal-case text-[9px] font-medium tracking-normal">
                                      {sourceType === "project" ? "Project" : "Task"}
                                      {note.sourceLabel ? ` · ${note.sourceLabel}` : ""}
                                    </span>
                                  </span>
                                </>
                              ) : null}
                            </div>
                            {!isLinked ? (
                              <div
                                className={cn(
                                  "flex items-center gap-0.5 transition-all duration-200",
                                  isMobile || selected
                                    ? "translate-x-0 opacity-100"
                                    : "translate-x-0 opacity-100 lg:translate-x-1 lg:opacity-0 lg:group-hover:translate-x-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-x-0 lg:group-focus-within:opacity-100"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    void handlePinToggle(note)
                                  }}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,transparent)]"
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
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-cyan)_26%,transparent)]"
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
                            ) : null}
                          </div>
                        </div>
                      )
                      })}
                    </div>
                    ) : null
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_84%,var(--surface-low)_16%)] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_92%,transparent)] shadow-[0_6px_18px_-14px_rgba(15,23,42,0.25)]">
                <NotebookPen className="h-4 w-4 text-[var(--text-muted)]" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">
                {hasSearchQuery ? `No results for "${searchQuery}"` : "No notes in this view"}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                {hasSearchQuery
                  ? "Try a different keyword or clear search."
                  : "Try switching between active and archived notes."}
              </p>
              {hasSearchQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 rounded-lg px-3 text-xs"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    ),
    [
      cancelRenameFolder,
      collapsedSections,
      commitRenameFolder,
      editingFolderId,
      editingFolderName,
      folders,
      foldersEnabled,
      handleArchiveToggle,
      handleCreateFolder,
      handleCreateNote,
      handleDelete,
      handlePinToggle,
      isAddingFolder,
      isCreating,
      isCreatingFolder,
      isRenamingFolder,
      newFolderName,
      selectedNoteId,
      showArchived,
      startRenameFolder,
      storageUnavailable,
      hasSearchQuery,
      searchQuery,
      touchFolderMenuId,
      visibleNotes.length,
      visibleSections,
    ]
  )

  return (
    <div className="flex h-[calc(100dvh-7.25rem-env(safe-area-inset-bottom))] min-h-[calc(100dvh-7.25rem-env(safe-area-inset-bottom))] flex-col gap-3 overflow-hidden lg:h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-3.5rem)]">
      <div className="rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:p-4 lg:p-5">
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
              showShortcutHint={false}
            />
          }
          actions={
            <Button
              type="button"
              className="header-action-button !h-11 !w-auto !min-w-0 !rounded-[24px] !px-8 !gap-2 !text-white xl:!px-9"
              onClick={() => void handleCreateNote({ content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="h-5 w-5 xl:mr-1.5 xl:h-4 xl:w-4" />
              <span className="inline text-sm font-semibold">Add</span>
            </Button>
          }
          mobileActions={
            <Button
              type="button"
              className="header-action-button !h-11 !w-auto !min-w-0 !rounded-[24px] !px-8 !gap-2 !text-white xl:!px-9"
              onClick={() => void handleCreateNote({ content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="h-5 w-5 xl:h-4 xl:w-4" />
              <span className="inline text-sm font-semibold">Add</span>
            </Button>
          }
        />
      </div>

      <Card className="flex-1 min-h-0 gap-0 overflow-hidden rounded-[24px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,var(--surface-low)_6%)] py-0 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
        <CardContent className="flex-1 min-h-0 p-0">
          <div className="grid h-full min-h-0 lg:grid-cols-[264px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 overflow-hidden border-r border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_84%,var(--bg-surface)_16%)] lg:block">
              {renderNotesList(false)}
            </aside>

            <section className="min-w-0 min-h-0 overflow-hidden bg-[color:color-mix(in_srgb,var(--surface-lowest)_92%,var(--surface-low)_8%)] lg:flex lg:flex-col">
              <div className="border-b border-[var(--line-subtle)] px-3 py-2.5 sm:px-3.5 sm:py-2.5 lg:hidden">
                <div className="inline-flex items-center gap-2">
                  <Sheet open={isMobileListOpen} onOpenChange={setIsMobileListOpen}>
                    <SheetTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl">
                        <NotebookPen className="mr-1.5 h-4 w-4" />
                        Notes ({visibleNotes.length})
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[86vw] border-r border-[var(--line-subtle)] p-0 sm:max-w-md">
                      <SheetHeader className="gap-3 border-b border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_90%,var(--bg-surface)_10%)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3 pr-10">
                          <SheetTitle>Notes</SheetTitle>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-xl px-3"
                            onClick={() => void handleCreateNote({ content: "" })}
                            disabled={isCreating || storageUnavailable}
                          >
                            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
                            Add
                          </Button>
                        </div>
                        <NotesSearchInput
                          ref={searchRef}
                          value={search}
                          onChange={setSearch}
                          showShortcutHint={false}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-[var(--text-muted)]">
                            {showArchived ? "Archived notes" : "Active notes"}
                          </p>
                          <Button
                            type="button"
                            variant={showArchived ? "default" : "outline"}
                            size="sm"
                            className="h-8 rounded-xl px-3"
                            onClick={() => setShowArchived((current) => !current)}
                          >
                            {showArchived ? "Archived" : "Active"}
                          </Button>
                        </div>
                      </SheetHeader>
                      {renderNotesList(true)}
                      <div className="border-t border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,transparent)] px-4 py-3">
                        <p className="text-[11px] font-medium text-[var(--text-muted)]">
                          Tap a note to open it in the editor.
                        </p>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {selectedNote ? (
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                  <div className="ui-scrollbar ui-scrollbar-inset mr-1 flex-1 min-h-0 space-y-3 overflow-y-auto p-3 pr-2 sm:p-4 sm:pr-3 lg:px-6 lg:pb-4 lg:pt-3.5 lg:pr-3">
                    <RichTextEditor
                      value={contentDraft}
                      onChange={setContentDraft}
                      placeholder="Write here..."
                      variant="plain"
                      mode="document"
                      notesMode
                      focusToken={editorFocusToken}
                      documentLayout="left"
                      uploadProjectId={editorUploadContextId}
                      documentWidth="reading"
                      toolbarActions={
                        selectedNoteIsLinked ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={appendTemplate}
                            className="h-11 w-11 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] lg:h-8 lg:w-8"
                            aria-label="Add template"
                            title="Add template"
                          >
                            <Plus className="h-5 w-5 lg:h-4 lg:w-4" />
                          </Button>
                        ) : undefined
                      }
                      className="rounded-[22px] bg-transparent [&_.ProseMirror]:text-[14px] [&_.ProseMirror]:leading-7 [&_.ProseMirror]:text-[var(--text-secondary)]"
                      minHeightClassName="min-h-[54vh] sm:min-h-[58vh] lg:min-h-[60vh]"
                    />
                  </div>
                  <div className="relative shrink-0 overflow-hidden bg-[color:color-mix(in_srgb,var(--surface-lowest)_94%,transparent)] px-3 py-2.5 sm:px-4 lg:px-6">
                    <div className="absolute inset-x-0 top-0 h-px bg-[var(--surface-low)]/80" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-[var(--text-muted)]">
                      {!selectedNoteIsLinked && foldersEnabled ? (
                        <>
                          <span className="text-[var(--text-secondary)]">Folder</span>
                          <Select
                            value={selectedNote.folderId || (defaultFolder?.id ?? NO_FOLDER_VALUE)}
                            onValueChange={(value) => {
                              void handleAssignFolder(selectedNote, value === NO_FOLDER_VALUE ? null : value)
                            }}
                          >
                            <SelectTrigger className="h-7 min-w-[160px] rounded-lg border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-[10px] font-medium text-[var(--text-secondary)] shadow-none focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-[var(--line-subtle)]">
                              {!foldersEnabled || !defaultFolder ? (
                                <SelectItem value={NO_FOLDER_VALUE}>Unfiled</SelectItem>
                              ) : null}
                              {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-[var(--text-muted)]">•</span>
                        </>
                      ) : null}
                      {selectedNoteIsLinked ? (
                        <>
                          <span className="text-[var(--text-secondary)]">
                            {selectedNoteSourceType === "project" ? "Project" : "Task"}: {selectedNote.title}
                          </span>
                          {selectedNote.sourceLabel ? (
                            <>
                              <span className="text-[var(--text-muted)]">•</span>
                              <span>{selectedNote.sourceLabel}</span>
                            </>
                          ) : null}
                          <span className="text-[var(--text-muted)]">•</span>
                        </>
                      ) : null}
                      <span>Created {format(new Date(selectedNote.createdAt), "dd.MM.yyyy")}</span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span>Updated {formatDistanceToNow(new Date(selectedNote.updatedAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ui-scrollbar ui-scrollbar-inset mr-1 flex-1 min-h-0 overflow-y-auto p-4 pr-2 sm:p-5 sm:pr-3 lg:p-6 lg:pr-3">
                  <div className="flex min-h-[320px] items-start justify-start rounded-[22px] border border-dashed border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--surface-lowest)_84%,var(--surface-low)_16%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] sm:p-7">
                    <div className="max-w-md space-y-2.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_8px_20px_-16px_rgba(15,23,42,0.28)]">
                        <NotebookPen className="h-5 w-5 text-[var(--text-muted)]" />
                      </div>
                      <div className="space-y-1 text-left">
                        <p className="text-[16px] font-semibold text-[var(--text-primary)]">Start a fresh note</p>
                        <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
                          Start typing right away. Your first line becomes the note title.
                        </p>
                      </div>
                      <div className="pt-1">
                        <Button
                          type="button"
                          className="h-10 rounded-xl"
                          onClick={() => void handleCreateNote({ content: "" })}
                          disabled={isCreating}
                        >
                          <FilePlus2 className="mr-1.5 h-4 w-4" />
                          New note
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

      <AlertDialog
        open={Boolean(pendingDeleteNote)}
        onOpenChange={(open) => {
          if (!open && !isDeletingNote) setPendingDeleteNote(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-50 text-rose-600">
              <Trash2 className="h-7 w-7" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteNote
                ? `This will permanently delete "${getNoteDisplayTitle(pendingDeleteNote)}".`
                : "This will permanently delete this note."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingNote}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeletingNote}
            >
              {isDeletingNote ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteFolder)}
        onOpenChange={(open) => {
          if (!open && !isDeletingFolder) setPendingDeleteFolder(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-50 text-rose-600">
              <Trash2 className="h-7 w-7" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteFolder
                ? `All notes from "${pendingDeleteFolder.name}" will be moved to "${defaultFolder?.name || "General"}".`
                : "All notes from this folder will be moved to the default folder."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFolder}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteFolder}
              disabled={isDeletingFolder}
            >
              {isDeletingFolder ? "Deleting..." : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
