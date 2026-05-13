"use client"

import * as React from "react"
import { format, formatDistanceToNow, isAfter, isToday, isYesterday, subDays } from "date-fns"
import {
  Archive,
  ArchiveRestore,
  Check,
  FilePlus2,
  Folder,
  FolderKanban,
  FolderPlus,
  ListTodo,
  MoreHorizontal,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  createNote,
  createNoteFolder,
  deleteNote,
  deleteNoteFolder,
  renameNoteFolder,
  setNoteArchived,
  setNotePinned,
  updateNote,
  type NoteFolderRecord,
  type NoteRecord,
} from "@/lib/actions/notes"
import { updateProject } from "@/lib/actions/projects"
import { updateTask } from "@/lib/actions/tasks"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

type RailKey = "all" | "pinned" | "archived" | "projects" | "tasks" | `folder:${string}`

type DateGroup = {
  key: "today" | "yesterday" | "previous30" | "older"
  label: string
  notes: NoteRecord[]
}

const NO_FOLDER_VALUE = "__none__"
const DEFAULT_RAIL_KEY: RailKey = "all"
const NOTE_SURFACE_FONT = "[font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Segoe UI',sans-serif]"

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

function folderRailKey(folderId: string): RailKey {
  return `folder:${folderId}`
}

function getFolderIdFromRailKey(rail: RailKey) {
  if (!rail.startsWith("folder:")) return null
  return rail.slice("folder:".length) || null
}

function toContentText(content: string) {
  return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function sortNotes(items: NoteRecord[]) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function upsertNote(items: NoteRecord[], next: NoteRecord) {
  const withoutCurrent = items.filter((item) => item.id !== next.id)
  return sortNotes([next, ...withoutCurrent])
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

function normalizeNoteContentForEditor(content: string) {
  const raw = (content || "").trim()
  if (!raw) return ""
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;")

  return raw
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

function hasMeaningfulContent(content: string) {
  return toContentText(content).trim().length > 0
}

function extractFirstImageSrc(content: string) {
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1] || null
}

function getFilteredByRail(notes: NoteRecord[], rail: RailKey) {
  if (rail === "all") {
    return notes.filter((note) => !(getNoteSourceType(note) === "note" && note.archived))
  }
  if (rail === "pinned") {
    return notes.filter((note) => getNoteSourceType(note) === "note" && !note.archived && note.pinned)
  }
  if (rail === "archived") {
    return notes.filter((note) => getNoteSourceType(note) === "note" && note.archived)
  }
  if (rail === "projects") {
    return notes.filter((note) => getNoteSourceType(note) === "project")
  }
  if (rail === "tasks") {
    return notes.filter((note) => getNoteSourceType(note) === "task")
  }
  const folderId = getFolderIdFromRailKey(rail)
  if (!folderId) return []
  return notes.filter(
    (note) => getNoteSourceType(note) === "note" && !note.archived && note.folderId === folderId
  )
}

function groupNotesByDate(notes: NoteRecord[]) {
  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const groups: Record<DateGroup["key"], NoteRecord[]> = {
    today: [],
    yesterday: [],
    previous30: [],
    older: [],
  }

  for (const note of notes) {
    const updated = new Date(note.updatedAt)
    if (isToday(updated)) {
      groups.today.push(note)
      continue
    }
    if (isYesterday(updated)) {
      groups.yesterday.push(note)
      continue
    }
    if (isAfter(updated, thirtyDaysAgo)) {
      groups.previous30.push(note)
      continue
    }
    groups.older.push(note)
  }

  return [
    { key: "today", label: "Today", notes: groups.today },
    { key: "yesterday", label: "Yesterday", notes: groups.yesterday },
    { key: "previous30", label: "Previous 30 Days", notes: groups.previous30 },
    { key: "older", label: "Older", notes: groups.older },
  ].filter((group) => group.notes.length > 0)
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
  const [activeRailKey, setActiveRailKey] = React.useState<RailKey>(DEFAULT_RAIL_KEY)
  const [contentDraft, setContentDraft] = React.useState("")
  const [emptyEditorDraft, setEmptyEditorDraft] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [isMobileRailOpen, setIsMobileRailOpen] = React.useState(false)
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
  const [folderMenuOpenId, setFolderMenuOpenId] = React.useState<string | null>(null)
  const [isRenamingFolder, setIsRenamingFolder] = React.useState(false)
  const [pendingDeleteFolder, setPendingDeleteFolder] = React.useState<NoteFolderRecord | null>(null)
  const [isDeletingFolder, setIsDeletingFolder] = React.useState(false)

  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const lastSyncedRef = React.useRef<{ id: string | null; title: string; content: string }>({
    id: null,
    title: "",
    content: "",
  })
  const transientEmptyNoteIdsRef = React.useRef<Set<string>>(new Set())
  const discardingNoteIdsRef = React.useRef<Set<string>>(new Set())
  const previousSelectedNoteIdRef = React.useRef<string | null>(initialSelectedNoteId)
  const bootstrappedRef = React.useRef(false)
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftCreateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftCreateInFlightRef = React.useRef(false)

  const selectedNote = React.useMemo(
    () => notes.find((item) => item.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  )

  const selectedNoteSourceType = React.useMemo(() => getNoteSourceType(selectedNote), [selectedNote])
  const selectedNoteIsLinked = selectedNoteSourceType !== "note"

  const defaultFolder = React.useMemo(
    () => folders.find((folder) => folder.isDefault) ?? null,
    [folders]
  )

  const smartCollectionCounts = React.useMemo(() => {
    const personalNotes = notes.filter((note) => getNoteSourceType(note) === "note")
    return {
      all: notes.filter((note) => !(getNoteSourceType(note) === "note" && note.archived)).length,
      pinned: personalNotes.filter((note) => !note.archived && note.pinned).length,
      archived: personalNotes.filter((note) => note.archived).length,
      projects: notes.filter((note) => getNoteSourceType(note) === "project").length,
      tasks: notes.filter((note) => getNoteSourceType(note) === "task").length,
    }
  }, [notes])

  const folderCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const folder of folders) counts.set(folder.id, 0)
    for (const note of notes) {
      if (getNoteSourceType(note) !== "note" || note.archived || !note.folderId) continue
      counts.set(note.folderId, (counts.get(note.folderId) || 0) + 1)
    }
    return counts
  }, [folders, notes])

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
    setEmptyEditorDraft("")
  }, [selectedNote, selectedNoteSourceType])

  const railFilteredNotes = React.useMemo(() => {
    return getFilteredByRail(notes, activeRailKey)
  }, [notes, activeRailKey])

  const filteredNotes = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const visible = railFilteredNotes.filter((note) => {
      if (!needle) return true
      return (
        getNoteDisplayTitle(note).toLowerCase().includes(needle) ||
        getNotePreview(note).toLowerCase().includes(needle) ||
        (note.sourceLabel || "").toLowerCase().includes(needle)
      )
    })

    const sorted = [...visible].sort((a, b) => {
      const scoreDiff = scoreSearchMatch(b, needle) - scoreSearchMatch(a, needle)
      if (needle && scoreDiff !== 0) return scoreDiff
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return sorted
  }, [railFilteredNotes, search])

  const groupedNotes = React.useMemo(() => groupNotesByDate(filteredNotes), [filteredNotes])

  React.useEffect(() => {
    if (!selectedNoteId) return
    const existsInRail = filteredNotes.some((note) => note.id === selectedNoteId)
    if (existsInRail) return
    const nextFallback = filteredNotes[0]?.id ?? null
    setSelectedNoteId(nextFallback)
  }, [filteredNotes, selectedNoteId])

  const editorUploadContextId = React.useMemo(() => {
    if (!selectedNote) return undefined
    if (selectedNoteSourceType === "project") {
      return selectedNote.sourceId || selectedNote.id.replace(/^project:/, "")
    }
    if (selectedNoteSourceType === "task") {
      return selectedNote.sourceProjectId || selectedNote.sourceId || selectedNote.id.replace(/^task:/, "")
    }
    return selectedNote.id
  }, [selectedNote, selectedNoteSourceType])

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
      const activeFolderId = getFolderIdFromRailKey(activeRailKey)
      setIsCreating(true)
      try {
        const result = await createNote({
          content: prefill?.content || "",
          folderId: activeFolderId ?? undefined,
        })
        if (!result.success || !result.data) {
          toast.error(result.error || "Failed to create note")
          return null
        }

        setNotes((current) => upsertNote(current, result.data as NoteRecord))
        if (hasMeaningfulContent(prefill?.content || "")) transientEmptyNoteIdsRef.current.delete(result.data.id)
        else transientEmptyNoteIdsRef.current.add(result.data.id)
        if (activeFolderId) {
          const createdFolderId = result.data.folderId || activeFolderId
          setActiveRailKey(folderRailKey(createdFolderId))
        } else {
          setActiveRailKey("all")
        }
        setSelectedNoteId(result.data.id)
        setEditorFocusToken((current) => current + 1)
        setIsMobileRailOpen(false)
        return result.data.id
      } finally {
        setIsCreating(false)
      }
    },
    [activeRailKey, storageUnavailable]
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
      setActiveRailKey(folderRailKey(result.data.id))
      toast.success("Folder created")
    } finally {
      setIsCreatingFolder(false)
    }
  }, [newFolderName])

  const startRenameFolder = React.useCallback((folder: NoteFolderRecord) => {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
    setFolderMenuOpenId(null)
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
      if (activeRailKey === folderRailKey(pendingDeleteFolder.id)) {
        setActiveRailKey(folderRailKey(result.data.defaultFolderId))
      }
      setFolderMenuOpenId(null)
      setPendingDeleteFolder(null)
      toast.success(`Folder deleted. Notes moved to ${result.data.defaultFolderName}.`)
    } finally {
      setIsDeletingFolder(false)
    }
  }, [activeRailKey, pendingDeleteFolder])

  const handleAssignFolder = React.useCallback(
    async (note: NoteRecord, folderId: string | null) => {
      if (!foldersEnabled) return
      if (getNoteSourceType(note) !== "note") return
      if (note.folderId === folderId) return

      const previousFolderId = note.folderId ?? null
      const previousFolderName = note.folderName ?? null
      const nextFolderName =
        folderId === null ? "Unfiled" : folders.find((folder) => folder.id === folderId)?.name || "Folder"

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
    if (!selectedNoteId) {
      const firstActive = notes.find((note) => !(getNoteSourceType(note) === "note" && note.archived)) ?? notes[0]
      if (firstActive) setSelectedNoteId(firstActive.id)
    }
  }, [notes, selectedNoteId])

  React.useEffect(() => {
    const currentSelectedId = selectedNoteId
    const previousSelectedId = previousSelectedNoteIdRef.current
    if (previousSelectedId && previousSelectedId !== currentSelectedId) {
      if (
        transientEmptyNoteIdsRef.current.has(previousSelectedId) &&
        !discardingNoteIdsRef.current.has(previousSelectedId)
      ) {
        transientEmptyNoteIdsRef.current.delete(previousSelectedId)
        discardingNoteIdsRef.current.add(previousSelectedId)
        void deleteNote(previousSelectedId)
          .then((result) => {
            if (result.success) {
              setNotes((current) => current.filter((item) => item.id !== previousSelectedId))
            }
          })
          .finally(() => {
            discardingNoteIdsRef.current.delete(previousSelectedId)
          })
      }
    }
    previousSelectedNoteIdRef.current = currentSelectedId
  }, [selectedNoteId])

  React.useEffect(() => {
    if (!selectedNoteId) return
    if (!transientEmptyNoteIdsRef.current.has(selectedNoteId)) return
    if (!hasMeaningfulContent(contentDraft)) return
    transientEmptyNoteIdsRef.current.delete(selectedNoteId)
  }, [contentDraft, selectedNoteId])

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
    }, 700)

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
      if (draftCreateTimeoutRef.current) clearTimeout(draftCreateTimeoutRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (selectedNoteId) return
    if (storageUnavailable) return
    if (!hasMeaningfulContent(emptyEditorDraft)) return
    if (draftCreateInFlightRef.current) return

    if (draftCreateTimeoutRef.current) clearTimeout(draftCreateTimeoutRef.current)
    draftCreateTimeoutRef.current = setTimeout(() => {
      if (draftCreateInFlightRef.current) return
      if (!hasMeaningfulContent(emptyEditorDraft)) return
      draftCreateInFlightRef.current = true
      void handleCreateNote({ content: emptyEditorDraft }).finally(() => {
        draftCreateInFlightRef.current = false
      })
    }, 550)

    return () => {
      if (draftCreateTimeoutRef.current) clearTimeout(draftCreateTimeoutRef.current)
    }
  }, [emptyEditorDraft, handleCreateNote, selectedNoteId, storageUnavailable])

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
      if (selectedNoteId === note.id && nextArchived) {
        setSelectedNoteId(filteredNotes.find((candidate) => candidate.id !== note.id)?.id ?? null)
      }
    },
    [filteredNotes, selectedNoteId]
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

  const handleDelete = React.useCallback(async (note: NoteRecord) => {
    if (getNoteSourceType(note) !== "note") return
    setPendingDeleteNote(note)
  }, [])

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
        setSelectedNoteId(filteredNotes.find((candidate) => candidate.id !== pendingDeleteNote.id)?.id ?? null)
      }
      setPendingDeleteNote(null)
    } finally {
      setIsDeletingNote(false)
    }
  }, [filteredNotes, pendingDeleteNote, selectedNoteId])

  const appendTemplate = React.useCallback(() => {
    if (selectedNoteSourceType === "project") {
      setContentDraft((current) =>
        current.trim() ? `${current}<p></p>${PROJECT_REQUIREMENTS_TEMPLATE}` : PROJECT_REQUIREMENTS_TEMPLATE
      )
      return
    }
    if (selectedNoteSourceType === "task") {
      setContentDraft((current) =>
        current.trim() ? `${current}<p></p>${TASK_NOTES_TEMPLATE}` : TASK_NOTES_TEMPLATE
      )
    }
  }, [selectedNoteSourceType])

  const searchQuery = search.trim()

  const railButtonClass = (active: boolean) =>
    cn(
      "group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[12px] transition-all",
      NOTE_SURFACE_FONT,
      active
        ? "bg-[color:color-mix(in_srgb,#e7ebf2_76%,white)] text-[#1e1f23]"
        : "text-[#4b5563] hover:bg-[color:color-mix(in_srgb,#f4f6f9_92%,white)]"
    )

  const renderLeftRail = (isMobile = false, compact = false) => (
    <div className={cn(compact ? "flex shrink-0 flex-col" : "flex h-full min-h-0 flex-col", NOTE_SURFACE_FONT)}>
      <div
        className={cn(
          compact
            ? cn("ui-scrollbar overflow-y-auto", isMobile ? "max-h-[36vh]" : "max-h-[280px]")
            : "ui-scrollbar flex-1 overflow-y-auto",
          isMobile ? "p-2.5" : "p-2"
        )}
      >
        <div className="space-y-0.5">
          <button type="button" onClick={() => setActiveRailKey("all")} className={railButtonClass(activeRailKey === "all") }>
            <span className="inline-flex items-center gap-1.5"><NotebookPen className="h-3.5 w-3.5" />All Notes</span>
            <span className="text-[10px] tabular-nums text-[#7b8796]">{smartCollectionCounts.all}</span>
          </button>
          <button type="button" onClick={() => setActiveRailKey("pinned")} className={railButtonClass(activeRailKey === "pinned") }>
            <span className="inline-flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" />Pinned</span>
            <span className="text-[10px] tabular-nums text-[#7b8796]">{smartCollectionCounts.pinned}</span>
          </button>
          <button type="button" onClick={() => setActiveRailKey("archived")} className={railButtonClass(activeRailKey === "archived") }>
            <span className="inline-flex items-center gap-1.5"><Archive className="h-3.5 w-3.5" />Archived</span>
            <span className="text-[10px] tabular-nums text-[#7b8796]">{smartCollectionCounts.archived}</span>
          </button>
          <button type="button" onClick={() => setActiveRailKey("projects")} className={railButtonClass(activeRailKey === "projects") }>
            <span className="inline-flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5" />Project Notes</span>
            <span className="text-[10px] tabular-nums text-[#7b8796]">{smartCollectionCounts.projects}</span>
          </button>
          <button type="button" onClick={() => setActiveRailKey("tasks")} className={railButtonClass(activeRailKey === "tasks") }>
            <span className="inline-flex items-center gap-1.5"><ListTodo className="h-3.5 w-3.5" />Task Notes</span>
            <span className="text-[10px] tabular-nums text-[#7b8796]">{smartCollectionCounts.tasks}</span>
          </button>
          {foldersEnabled ? (
            <button
              type="button"
              onClick={() => setIsAddingFolder((current) => !current)}
              className={cn(
                railButtonClass(false),
                "mt-1 border border-dashed border-[#d7dde7] text-[#5f6c7d] hover:border-[#c9d1de]"
              )}
              disabled={isCreatingFolder || storageUnavailable}
            >
              <span className="inline-flex items-center gap-1.5">
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </span>
            </button>
          ) : null}
          {isAddingFolder ? (
            <div className="mt-1.5 flex items-center gap-1.5 px-1">
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
                className="h-7 rounded-lg border-[#d8dde6] bg-white text-[11px]"
              />
              <Button
                type="button"
                size="sm"
                className="h-7 rounded-lg px-2 text-[11px]"
                onClick={() => void handleCreateFolder()}
                disabled={isCreatingFolder || storageUnavailable}
              >
                Add
              </Button>
            </div>
          ) : null}
          {foldersEnabled ? (
            <div className="mt-1.5 space-y-0.5">
              {folders.map((folder) => {
                const key = folderRailKey(folder.id)
                const active = activeRailKey === key
                const isEditing = editingFolderId === folder.id
                const isMenuOpen = folderMenuOpenId === folder.id
                return (
                  <div
                    key={folder.id}
                    className={cn("group rounded-lg px-1.5 py-0.5", active ? "bg-[#eef2f7]" : "")}
                    onContextMenu={(event) => {
                      if (isEditing) return
                      event.preventDefault()
                      setFolderMenuOpenId(folder.id)
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveRailKey(key)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px]",
                          active ? "text-[#111827]" : "text-[#556171]"
                        )}
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        {isEditing ? (
                          <Input
                            value={editingFolderName}
                            onChange={(event) => setEditingFolderName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                void commitRenameFolder()
                              }
                              if (event.key === "Escape") {
                                event.preventDefault()
                                cancelRenameFolder()
                              }
                            }}
                            className="h-6 min-w-0 rounded-md border-[#d8dde6] bg-white px-2 text-[11px]"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate">{folder.name}</span>
                        )}
                      </button>
                      <span className="text-[10px] tabular-nums text-[#7b8796]">{folderCounts.get(folder.id) || 0}</span>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void commitRenameFolder()}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#5b6573] hover:bg-[#e9edf2]"
                            disabled={isRenamingFolder}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRenameFolder}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#5b6573] hover:bg-[#e9edf2]"
                            disabled={isRenamingFolder}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <DropdownMenu
                          open={isMenuOpen}
                          onOpenChange={(open) => setFolderMenuOpenId(open ? folder.id : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "inline-flex h-6 w-6 items-center justify-center rounded-md text-[#5b6573] transition-opacity hover:bg-[#e9edf2]",
                                isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              )}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Folder actions for ${folder.name}`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg">
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation()
                                startRenameFolder(folder)
                              }}
                            >
                              Rename folder
                            </DropdownMenuItem>
                            {!folder.isDefault ? (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingDeleteFolder(folder)
                                }}
                              >
                                Delete folder
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderMiddleList = (isMobile = false) => (
    <div className={cn("flex h-full min-h-0 flex-col", NOTE_SURFACE_FONT)}>
      <div className="border-b border-[#e8eaee] px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b95a3]">{searchQuery ? "Search Results" : "Notes"}</p>
          <span className="text-[11px] tabular-nums text-[#8b95a3]">{filteredNotes.length}</span>
        </div>
      </div>
      <div className={cn("ui-scrollbar flex-1 overflow-y-auto", isMobile ? "p-3" : "p-2.5") }>
        {groupedNotes.length ? (
          <div className="space-y-4">
            {groupedNotes.map((group) => (
              <div key={group.key}>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">{group.label}</p>
                <div className="mt-1.5 space-y-1">
                  {group.notes.map((note) => {
                    const selected = note.id === selectedNoteId
                    const sourceType = getNoteSourceType(note)
                    const imageSrc = extractFirstImageSrc(note.content || "")
                    const isLinked = sourceType !== "note"
                    return (
                      <div
                        key={note.id}
                        onClick={() => {
                          setSelectedNoteId(note.id)
                          if (isMobile) setIsMobileRailOpen(false)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedNoteId(note.id)
                            if (isMobile) setIsMobileRailOpen(false)
                          }
                        }}
                        className={cn(
                          "group rounded-[10px] border border-transparent px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6becb]",
                          selected ? "bg-[#e9edf3]" : "hover:bg-[#f3f5f8]"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#e9edf2]">
                            {imageSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageSrc} alt="Note preview" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#aab4c3]"><NotebookPen className="h-3.5 w-3.5" /></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-[14px] font-semibold tracking-[-0.01em] text-[#1f2937]">{getNoteDisplayTitle(note)}</p>
                            <p className="mt-0.5 line-clamp-1 text-[12px] text-[#667085]">{getNotePreview(note)}</p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <p className="truncate text-[11px] text-[#98a2b3]">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</p>
                              <div className="flex items-center gap-0.5">
                                {!isLinked ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        void handlePinToggle(note)
                                      }}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] hover:bg-white"
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
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] hover:bg-white"
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
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                                      aria-label="Delete note"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="rounded-md bg-[#eef1f6] px-1.5 py-0.5 text-[10px] text-[#667085]">
                                    {sourceType === "project" ? "Project" : "Task"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d8dee8] bg-[#f7f8fa] p-5 text-center">
            <p className="text-sm font-medium text-[#4b5563]">
              {searchQuery ? `No results for "${searchQuery}"` : "No notes in this view"}
            </p>
            <p className="mt-1 text-[12px] text-[#8b95a3]">
              {searchQuery ? "Try another keyword or clear search." : "Create a note or switch collection."}
            </p>
            {searchQuery ? (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )

  const activeRailLabel = React.useMemo(() => {
    if (activeRailKey === "all") return "All Notes"
    if (activeRailKey === "pinned") return "Pinned"
    if (activeRailKey === "archived") return "Archived"
    if (activeRailKey === "projects") return "Project Notes"
    if (activeRailKey === "tasks") return "Task Notes"
    const folderId = getFolderIdFromRailKey(activeRailKey)
    if (!folderId) return "Notes"
    return folders.find((folder) => folder.id === folderId)?.name || "Folder"
  }, [activeRailKey, folders])

  const showArchivedMode = activeRailKey === "archived"

  return (
    <div className={cn("flex h-[calc(100dvh-7.2rem-env(safe-area-inset-bottom))] min-h-[calc(100dvh-7.2rem-env(safe-area-inset-bottom))] flex-col gap-3 overflow-hidden lg:h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-3.5rem)]", NOTE_SURFACE_FONT)}>
      <div className="rounded-[20px] border border-[#e7eaf0] bg-[#f8f9fb] p-3 shadow-[0_8px_18px_-20px_rgba(15,23,42,0.5)] sm:p-4 lg:p-4">
        <DashboardPageHeader
          title="Notes"
          showMobile
          className={NOTE_SURFACE_FONT}
          search={
            <div className="flex items-center gap-2">
              <NotesSearchInput ref={searchRef} value={search} onChange={setSearch} variant="apple" density="comfortable" />
              <Button
                type="button"
                variant={showArchivedMode ? "default" : "outline"}
                className="h-10 rounded-[12px] border-[#d7dce4] bg-white px-4 text-[13px] font-semibold text-[#4b5563]"
                onClick={() => setActiveRailKey(showArchivedMode ? "all" : "archived")}
              >
                {showArchivedMode ? "Archived" : "Active"}
              </Button>
            </div>
          }
          mobileSearch={<NotesSearchInput ref={searchRef} value={search} onChange={setSearch} showShortcutHint={false} variant="apple" density="compact" />}
          actions={
            <Button
              type="button"
              className="!h-10 !w-auto !min-w-0 !rounded-[12px] !border !border-[#d5dae3] !bg-[color:color-mix(in_srgb,#f4f6fa_94%,white)] !px-5 !text-[#1f2937] hover:!bg-[#eceff4]"
              onClick={() => void handleCreateNote({ content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="h-4 w-4" />
              <span className="inline text-sm font-semibold">Add</span>
            </Button>
          }
          mobileActions={
            <Button
              type="button"
              className="!h-10 !w-auto !min-w-0 !rounded-[12px] !border !border-[#d5dae3] !bg-[color:color-mix(in_srgb,#f4f6fa_94%,white)] !px-5 !text-[#1f2937] hover:!bg-[#eceff4]"
              onClick={() => void handleCreateNote({ content: "" })}
              disabled={isCreating || storageUnavailable}
            >
              <FilePlus2 className="h-4 w-4" />
              <span className="inline text-sm font-semibold">Add</span>
            </Button>
          }
        />
      </div>

      <Card className="flex-1 min-h-0 gap-0 overflow-hidden rounded-[20px] border border-[#e7eaf0] bg-[#fbfbfc] py-0 shadow-[0_12px_28px_-30px_rgba(15,23,42,0.52)]">
        <CardContent className="flex-1 min-h-0 p-0">
          <div className="hidden h-full min-h-0 md:grid md:grid-cols-[312px_minmax(0,1fr)] xl:grid-cols-[336px_minmax(0,1fr)]">
            <aside className="min-h-0 border-r border-[#e8eaee] bg-[#f7f8fa]">
              <div className="flex h-full min-h-0 flex-col">
                {renderLeftRail(false, true)}
                <div className="min-h-0 flex-1 border-t border-[#e8eaee]">
                  {renderMiddleList(false)}
                </div>
              </div>
            </aside>

            <section className="min-w-0 min-h-0 overflow-hidden bg-white">
              {selectedNote ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="ui-scrollbar ui-scrollbar-inset mr-1 flex-1 min-h-0 overflow-y-auto p-3 pr-2 sm:p-4 sm:pr-3 lg:px-6 lg:pb-4 lg:pt-4 lg:pr-3">
                    <RichTextEditor
                      value={contentDraft}
                      onChange={setContentDraft}
                      placeholder="Start writing"
                      variant="plain"
                      mode="document"
                      notesMode
                      notesAppearance="apple"
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
                            className="h-10 w-10 rounded-full text-[#6b7280] hover:bg-[#eef1f6] hover:text-[#1f2937] lg:h-8 lg:w-8"
                            aria-label="Add template"
                            title="Add template"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        ) : undefined
                      }
                      className="rounded-[18px] bg-transparent"
                      minHeightClassName="min-h-[56vh]"
                    />
                  </div>
                  <div className="border-t border-[#e8eaee] px-5 py-2 lg:px-7">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#98a2b3]">
                        <span>{format(new Date(selectedNote.updatedAt), "d MMMM yyyy 'at' HH:mm")}</span>
                        <span>•</span>
                        <span>{activeRailLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedNoteIsLinked && foldersEnabled ? (
                          <Select
                            value={selectedNote.folderId || (defaultFolder?.id ?? NO_FOLDER_VALUE)}
                            onValueChange={(value) => {
                              void handleAssignFolder(selectedNote, value === NO_FOLDER_VALUE ? null : value)
                            }}
                          >
                            <SelectTrigger className="h-8 min-w-[160px] rounded-[10px] border-[#d7dce4] bg-white px-2 text-xs font-medium text-[#4b5563] shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-[#dde3eb]">
                              {!foldersEnabled || !defaultFolder ? <SelectItem value={NO_FOLDER_VALUE}>Unfiled</SelectItem> : null}
                              {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        {selectedNoteIsLinked ? (
                          <span className="rounded-lg bg-[#eef1f6] px-2.5 py-1 text-[11px] font-medium text-[#667085]">
                            {selectedNoteSourceType === "project" ? "Project" : "Task"}
                            {selectedNote.sourceLabel ? ` · ${selectedNote.sourceLabel}` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="ui-scrollbar ui-scrollbar-inset mr-1 flex-1 min-h-0 overflow-y-auto p-3 pr-2 sm:p-4 sm:pr-3 lg:px-6 lg:pb-4 lg:pt-4 lg:pr-3">
                    <RichTextEditor
                      value={emptyEditorDraft}
                      onChange={setEmptyEditorDraft}
                      placeholder="Start writing"
                      variant="plain"
                      mode="document"
                      notesMode
                      notesAppearance="apple"
                      documentLayout="left"
                      documentWidth="reading"
                      className="rounded-[18px] bg-transparent"
                      minHeightClassName="min-h-[56vh]"
                    />
                  </div>
                  <div className="border-t border-[#e8eaee] px-5 py-2 lg:px-7">
                    <div className="flex items-center gap-2 text-[12px] text-[#98a2b3]">
                      <span>{activeRailLabel}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="md:hidden h-full min-h-0">
            <div className="flex items-center gap-2 border-b border-[#e8eaee] bg-white px-3 py-2.5">
              <Sheet open={isMobileRailOpen} onOpenChange={setIsMobileRailOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-[12px] border-[#d7dce4] bg-white">
                    <Folder className="mr-1.5 h-4 w-4" />
                    Sidebar
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[90vw] border-r border-[#e8eaee] bg-[#f7f8fa] p-0 sm:max-w-md">
                  <SheetHeader className="border-b border-[#e8eaee] bg-[#f7f8fa] px-4 py-3">
                    <SheetTitle className={NOTE_SURFACE_FONT}>Notes</SheetTitle>
                  </SheetHeader>
                  <div className="flex h-full min-h-0 flex-col">
                    {renderLeftRail(true, true)}
                    <div className="min-h-0 flex-1 border-t border-[#e8eaee]">
                      {renderMiddleList(true)}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <div className={cn("text-[12px] text-[#6b7280]", NOTE_SURFACE_FONT)}>
                {activeRailLabel} ({filteredNotes.length})
              </div>
            </div>

            <section className="h-[calc(100%-53px)] min-h-0 overflow-hidden bg-white">
              {selectedNote ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="ui-scrollbar ui-scrollbar-inset mr-1 flex-1 min-h-0 overflow-y-auto p-3 pr-2">
                    <RichTextEditor
                      value={contentDraft}
                      onChange={setContentDraft}
                      placeholder="Start writing"
                      variant="plain"
                      mode="document"
                      notesMode
                      notesAppearance="apple"
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
                            className="h-10 w-10 rounded-full text-[#6b7280] hover:bg-[#eef1f6] hover:text-[#1f2937]"
                            aria-label="Add template"
                            title="Add template"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        ) : undefined
                      }
                      className="rounded-[16px] bg-transparent"
                      minHeightClassName="min-h-[60vh]"
                    />
                  </div>
                  <div className="border-t border-[#e8eaee] px-4 py-2">
                    <div className="space-y-2">
                      <div className={cn("flex items-center gap-2 text-[12px] text-[#98a2b3]", NOTE_SURFACE_FONT)}>
                        <span>{formatDistanceToNow(new Date(selectedNote.updatedAt), { addSuffix: true })}</span>
                        <span>•</span>
                        <span className="truncate">{activeRailLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedNoteIsLinked && foldersEnabled ? (
                          <Select
                            value={selectedNote.folderId || (defaultFolder?.id ?? NO_FOLDER_VALUE)}
                            onValueChange={(value) => {
                              void handleAssignFolder(selectedNote, value === NO_FOLDER_VALUE ? null : value)
                            }}
                          >
                            <SelectTrigger className="h-8 min-w-[150px] rounded-[10px] border-[#d7dce4] bg-white px-2 text-xs font-medium text-[#4b5563] shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-[#dde3eb]">
                              {!foldersEnabled || !defaultFolder ? <SelectItem value={NO_FOLDER_VALUE}>Unfiled</SelectItem> : null}
                              {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        {selectedNoteIsLinked ? (
                          <span className="rounded-lg bg-[#eef1f6] px-2.5 py-1 text-[11px] font-medium text-[#667085]">
                            {selectedNoteSourceType === "project" ? "Project" : "Task"}
                            {selectedNote.sourceLabel ? ` · ${selectedNote.sourceLabel}` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="ui-scrollbar ui-scrollbar-inset mr-1 flex-1 min-h-0 overflow-y-auto p-3 pr-2">
                    <RichTextEditor
                      value={emptyEditorDraft}
                      onChange={setEmptyEditorDraft}
                      placeholder="Start writing"
                      variant="plain"
                      mode="document"
                      notesMode
                      notesAppearance="apple"
                      documentLayout="left"
                      documentWidth="reading"
                      className="rounded-[16px] bg-transparent"
                      minHeightClassName="min-h-[60vh]"
                    />
                  </div>
                  <div className="border-t border-[#e8eaee] px-4 py-2">
                    <div className={cn("flex items-center gap-2 text-[12px] text-[#98a2b3]", NOTE_SURFACE_FONT)}>
                      <span className="truncate">{activeRailLabel}</span>
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
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={isDeletingNote}>
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
            <AlertDialogAction variant="destructive" onClick={confirmDeleteFolder} disabled={isDeletingFolder}>
              {isDeletingFolder ? "Deleting..." : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
