"use client"

import * as React from "react"
import { format, formatDistanceToNow, isAfter, isToday, isYesterday, subDays } from "date-fns"
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FilePlus2,
  Folder,
  FolderInput,
  FolderKanban,
  FolderPlus,
  Grid2X2,
  Hash,
  List,
  ListTodo,
  MoreHorizontal,
  NotebookPen,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  createNote,
  createNoteFolder,
  createNoteSmartFolder,
  deleteNote,
  deleteNoteFolder,
  moveNoteFolder,
  permanentlyDeleteNote,
  renameNoteFolder,
  restoreNote,
  setNoteArchived,
  setNotePinned,
  updateNote,
  type NoteFolderRecord,
  type NoteRecord,
  type NoteSmartFolderRecord,
  type NoteTagRecord,
} from "@/lib/actions/notes"
import { updateProject } from "@/lib/actions/projects"
import { updateTask } from "@/lib/actions/tasks"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { NotesSearchInput } from "@/components/notes/notes-search-input"
import { NotesSidebarPane } from "@/components/notes/notes-sidebar-pane"
import { NotesListPane } from "@/components/notes/notes-list-pane"
import { NotesEditorPane } from "@/components/notes/notes-editor-pane"
import {
  useNotesWorkspacePreferences,
} from "@/components/notes/use-notes-workspace-preferences"
import { cn } from "@/lib/utils"
import { matchesNoteSmartFolder } from "@/lib/notes/apple-notes"
import {
  DEFAULT_NOTE_PREVIEW,
  DEFAULT_NOTE_TITLE,
  deriveNoteTitleFromContent,
  derivePreviewBodyFromContent,
} from "@/lib/notes/derived-note-text"

type NotesWorkspaceProps = {
  initialNotes: NoteRecord[]
  initialSelectedNoteId: string | null
  initialView?: string
  initialFolders: NoteFolderRecord[]
  initialTags?: NoteTagRecord[]
  initialSmartFolders?: NoteSmartFolderRecord[]
  foldersEnabled?: boolean
  productivityFeaturesEnabled?: boolean
  storageUnavailable?: boolean
}

type RailKey =
  | "all"
  | "pinned"
  | "archived"
  | "deleted"
  | "projects"
  | "tasks"
  | `folder:${string}`
  | `tag:${string}`
  | `smart:${string}`

type SearchScope = "view" | "all"
type MobilePane = "folders" | "list" | "editor"
type SaveState = "idle" | "saving" | "saved" | "error"

type DateGroup = {
  key: "pinned" | "today" | "yesterday" | "previous30" | "older"
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

function sortFoldersForDisplay(items: NoteFolderRecord[]) {
  const byOrder = (a: NoteFolderRecord, b: NoteFolderRecord) =>
    (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000) ||
    (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1) ||
    a.name.localeCompare(b.name)
  const roots = items.filter((folder) => !folder.parentId).sort(byOrder)
  const nested = new Map<string, NoteFolderRecord[]>()
  for (const folder of items.filter((candidate) => Boolean(candidate.parentId))) {
    const parentId = folder.parentId as string
    nested.set(parentId, [...(nested.get(parentId) || []), folder])
  }
  return roots.flatMap((folder) => [
    folder,
    ...(nested.get(folder.id) || []).sort(byOrder),
  ])
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
  const src = match?.[1]?.trim()
  if (!src) return null
  if (src.startsWith("/") || src.startsWith("data:image/") || src.startsWith("blob:")) {
    return src
  }
  try {
    const parsed = new URL(src)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? src : null
  } catch {
    return null
  }
}

function getFilteredByRail(notes: NoteRecord[], rail: RailKey) {
  if (rail === "all") {
    return notes.filter(
      (note) =>
        getNoteSourceType(note) === "note" &&
        !note.archived &&
        !note.deletedAt
    )
  }
  if (rail === "pinned") {
    return notes.filter(
      (note) =>
        getNoteSourceType(note) === "note" &&
        !note.archived &&
        !note.deletedAt &&
        note.pinned
    )
  }
  if (rail === "archived") {
    return notes.filter(
      (note) => getNoteSourceType(note) === "note" && note.archived && !note.deletedAt
    )
  }
  if (rail === "deleted") {
    return notes.filter(
      (note) => getNoteSourceType(note) === "note" && Boolean(note.deletedAt)
    )
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
    (note) =>
      getNoteSourceType(note) === "note" &&
      !note.archived &&
      !note.deletedAt &&
      note.folderId === folderId
  )
}

function groupNotesByDate(notes: NoteRecord[]) {
  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const groups: Record<DateGroup["key"], NoteRecord[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    previous30: [],
    older: [],
  }

  for (const note of notes) {
    if (note.pinned && !note.deletedAt) {
      groups.pinned.push(note)
      continue
    }
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
    { key: "pinned", label: "Pinned", notes: groups.pinned },
    { key: "today", label: "Today", notes: groups.today },
    { key: "yesterday", label: "Yesterday", notes: groups.yesterday },
    { key: "previous30", label: "Previous 30 Days", notes: groups.previous30 },
    { key: "older", label: "Older", notes: groups.older },
  ].filter((group) => group.notes.length > 0)
}

export function NotesWorkspace({
  initialNotes,
  initialSelectedNoteId,
  initialView,
  initialFolders,
  initialTags = [],
  initialSmartFolders = [],
  foldersEnabled = true,
  productivityFeaturesEnabled = true,
  storageUnavailable = false,
}: NotesWorkspaceProps) {
  const [notes, setNotes] = React.useState<NoteRecord[]>(() => sortNotes(initialNotes))
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(initialSelectedNoteId)
  const [activeRailKey, setActiveRailKey] = React.useState<RailKey>(() => {
    const view = initialView || ""
    if (
      view === "all" ||
      view === "pinned" ||
      view === "archived" ||
      view === "deleted" ||
      view === "projects" ||
      view === "tasks" ||
      view.startsWith("folder:") ||
      view.startsWith("tag:") ||
      view.startsWith("smart:")
    ) {
      return view as RailKey
    }
    return DEFAULT_RAIL_KEY
  })
  const [contentDraft, setContentDraft] = React.useState("")
  const [emptyEditorDraft, setEmptyEditorDraft] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [isMobileRailOpen, setIsMobileRailOpen] = React.useState(false)
  const [mobilePane, setMobilePane] = React.useState<MobilePane>(
    initialSelectedNoteId ? "editor" : "folders"
  )
  const [tabletSidebarOpen, setTabletSidebarOpen] = React.useState(false)
  const [searchScope, setSearchScope] = React.useState<SearchScope>("view")
  const {
    sidebarWidth,
    setSidebarWidth,
    listWidth,
    setListWidth,
    listMode,
    setListMode,
    noteSort,
    setNoteSort,
  } = useNotesWorkspacePreferences()
  const [saveState, setSaveState] = React.useState<SaveState>("idle")
  const [rowMenuNoteId, setRowMenuNoteId] = React.useState<string | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)
  const [pendingDeleteNote, setPendingDeleteNote] = React.useState<NoteRecord | null>(null)
  const [deletePermanently, setDeletePermanently] = React.useState(false)
  const [isDeletingNote, setIsDeletingNote] = React.useState(false)
  const [editorFocusToken, setEditorFocusToken] = React.useState(0)
  const [folders, setFolders] = React.useState<NoteFolderRecord[]>(() =>
    sortFoldersForDisplay(initialFolders)
  )
  const [tags] = React.useState<NoteTagRecord[]>(initialTags)
  const [smartFolders, setSmartFolders] = React.useState<NoteSmartFolderRecord[]>(initialSmartFolders)
  const [isSmartFolderDialogOpen, setIsSmartFolderDialogOpen] = React.useState(false)
  const [smartFolderName, setSmartFolderName] = React.useState("")
  const [smartFolderMatchMode, setSmartFolderMatchMode] = React.useState<"all" | "any">("all")
  const [smartFolderTagIds, setSmartFolderTagIds] = React.useState<string[]>([])
  const [smartFolderPinned, setSmartFolderPinned] = React.useState(false)
  const [smartFolderChecklist, setSmartFolderChecklist] = React.useState(false)
  const [smartFolderAttachment, setSmartFolderAttachment] = React.useState(false)
  const [smartFolderUpdatedDays, setSmartFolderUpdatedDays] = React.useState<string>("none")
  const [isCreatingSmartFolder, setIsCreatingSmartFolder] = React.useState(false)
  const [isAddingFolder, setIsAddingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [newFolderParentId, setNewFolderParentId] = React.useState<string | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false)
  const [editingFolderId, setEditingFolderId] = React.useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = React.useState("")
  const [isRenamingFolder, setIsRenamingFolder] = React.useState(false)
  const [pendingDeleteFolder, setPendingDeleteFolder] = React.useState<NoteFolderRecord | null>(null)
  const [isDeletingFolder, setIsDeletingFolder] = React.useState(false)
  const [draggedNoteId, setDraggedNoteId] = React.useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = React.useState<string | null>(null)
  const [movingNoteId, setMovingNoteId] = React.useState<string | null>(null)

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
  const draggedNoteIdRef = React.useRef<string | null>(null)
  const dragPreviewRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("view", activeRailKey)
    if (selectedNoteId) url.searchParams.set("note", selectedNoteId)
    else url.searchParams.delete("note")
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
  }, [activeRailKey, selectedNoteId])

  const beginPaneResize = React.useCallback(
    (
      event: React.PointerEvent<HTMLButtonElement>,
      pane: "sidebar" | "list"
    ) => {
      event.preventDefault()
      const startX = event.clientX
      const initialWidth = pane === "sidebar" ? sidebarWidth : listWidth
      const min = pane === "sidebar" ? 200 : 280
      const max = pane === "sidebar" ? 320 : 440
      const onMove = (moveEvent: PointerEvent) => {
        const next = Math.min(max, Math.max(min, initialWidth + moveEvent.clientX - startX))
        if (pane === "sidebar") setSidebarWidth(next)
        else setListWidth(next)
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [listWidth, setListWidth, setSidebarWidth, sidebarWidth]
  )

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
      all: personalNotes.filter((note) => !note.archived && !note.deletedAt).length,
      pinned: personalNotes.filter(
        (note) => !note.archived && !note.deletedAt && note.pinned
      ).length,
      archived: personalNotes.filter((note) => note.archived && !note.deletedAt).length,
      deleted: personalNotes.filter((note) => Boolean(note.deletedAt)).length,
      projects: notes.filter((note) => getNoteSourceType(note) === "project").length,
      tasks: notes.filter((note) => getNoteSourceType(note) === "task").length,
    }
  }, [notes])

  const folderCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const folder of folders) counts.set(folder.id, 0)
    for (const note of notes) {
      if (
        getNoteSourceType(note) !== "note" ||
        note.archived ||
        note.deletedAt ||
        !note.folderId
      ) continue
      counts.set(note.folderId, (counts.get(note.folderId) || 0) + 1)
    }
    return counts
  }, [folders, notes])

  const tagCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const tag of tags) counts.set(tag.id, 0)
    for (const note of notes) {
      if (
        getNoteSourceType(note) !== "note" ||
        note.archived ||
        note.deletedAt
      ) continue
      for (const tag of note.tags || []) {
        counts.set(tag.id, (counts.get(tag.id) || 0) + 1)
      }
    }
    return counts
  }, [notes, tags])

  React.useEffect(() => {
    setSaveState("idle")
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
    if (activeRailKey.startsWith("tag:")) {
      const tagId = activeRailKey.slice("tag:".length)
      return notes.filter(
        (note) =>
          getNoteSourceType(note) === "note" &&
          !note.archived &&
          !note.deletedAt &&
          note.tags?.some((tag) => tag.id === tagId)
      )
    }
    if (activeRailKey.startsWith("smart:")) {
      const smartFolderId = activeRailKey.slice("smart:".length)
      const smartFolder = smartFolders.find((folder) => folder.id === smartFolderId)
      if (!smartFolder) return []
      return notes.filter(
        (note) =>
          getNoteSourceType(note) === "note" &&
          !note.archived &&
          !note.deletedAt &&
          matchesNoteSmartFolder(
            {
              pinned: note.pinned,
              hasChecklist: Boolean(note.hasChecklist),
              hasAttachment: Boolean(note.hasAttachment),
              updatedAt: note.updatedAt,
              tagIds: (note.tags || []).map((tag) => tag.id),
            },
            {
              matchMode: smartFolder.matchMode,
              requirePinned: smartFolder.requirePinned,
              requireChecklist: smartFolder.requireChecklist,
              requireAttachment: smartFolder.requireAttachment,
              updatedWithinDays: smartFolder.updatedWithinDays as 1 | 7 | 30 | 90 | null,
              tagIds: smartFolder.tags.map((tag) => tag.id),
            }
          )
      )
    }
    return getFilteredByRail(notes, activeRailKey)
  }, [notes, activeRailKey, smartFolders])

  const filteredNotes = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const searchBase =
      searchScope === "all" && search.trim()
        ? notes.filter(
            (note) =>
              getNoteSourceType(note) === "note" &&
              !note.archived &&
              !note.deletedAt
          )
        : railFilteredNotes
    const visible = searchBase.filter((note) => {
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
      if (noteSort === "title") {
        return getNoteDisplayTitle(a).localeCompare(getNoteDisplayTitle(b))
      }
      if (noteSort === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return sorted
  }, [noteSort, notes, railFilteredNotes, search, searchScope])

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
      setSaveState("saving")

      if (sourceType === "project") {
        const projectId = existingNote.sourceId || existingNote.id.replace(/^project:/, "")
        const result = await updateProject(projectId, { description: contentValue })
        if (!result.success) {
          setSaveState("error")
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
        setSaveState("saved")
        return true
      }

      if (sourceType === "task") {
        const taskId = existingNote.sourceId || existingNote.id.replace(/^task:/, "")
        const result = await updateTask(taskId, { description: contentValue })
        if (!result.success) {
          setSaveState("error")
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
        setSaveState("saved")
        return true
      }

      if (storageUnavailable) {
        setSaveState("error")
        toast.error("Notes storage is not ready yet")
        return false
      }

      const result = await updateNote(noteId, {
        content: contentValue,
      })

      if (!result.success || !result.data) {
        setSaveState("error")
        toast.error(result.error || "Failed to save note")
        return false
      }

      setNotes((current) => upsertNote(current, result.data as NoteRecord))
      lastSyncedRef.current = {
        id: result.data.id,
        title: result.data.title,
        content: result.data.content,
      }
      setSaveState("saved")
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
      const result = await createNoteFolder({ name, parentId: newFolderParentId })
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to create folder")
        return
      }
      setFolders((current) => {
        const exists = current.some((folder) => folder.id === result.data.id)
        if (exists) return current
        return sortFoldersForDisplay([...current, result.data])
      })
      setNewFolderName("")
      setNewFolderParentId(null)
      setIsAddingFolder(false)
      setActiveRailKey(folderRailKey(result.data.id))
      toast.success("Folder created")
    } finally {
      setIsCreatingFolder(false)
    }
  }, [newFolderName, newFolderParentId])

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
        sortFoldersForDisplay(
          current.map((folder) => (folder.id === result.data.id ? result.data : folder))
        )
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

  const reorderFolder = React.useCallback(
    async (folder: NoteFolderRecord, direction: -1 | 1) => {
      const siblings = folders
        .filter((candidate) => (candidate.parentId ?? null) === (folder.parentId ?? null))
        .sort(
          (a, b) =>
            (a.sortOrder ?? 1000) - (b.sortOrder ?? 1000) ||
            a.name.localeCompare(b.name)
        )
      const index = siblings.findIndex((candidate) => candidate.id === folder.id)
      const swapWith = siblings[index + direction]
      if (index < 0 || !swapWith) return
      const folderOrder = folder.sortOrder ?? (index + 1) * 1000
      const swapOrder = swapWith.sortOrder ?? (index + direction + 1) * 1000

      const [folderResult, swapResult] = await Promise.all([
        moveNoteFolder(folder.id, {
          parentId: folder.parentId ?? null,
          sortOrder: swapOrder,
        }),
        moveNoteFolder(swapWith.id, {
          parentId: swapWith.parentId ?? null,
          sortOrder: folderOrder,
        }),
      ])
      if (!folderResult.success || !folderResult.data || !swapResult.success || !swapResult.data) {
        toast.error(folderResult.error || swapResult.error || "Failed to reorder folders")
        return
      }
      setFolders((current) =>
        sortFoldersForDisplay(
          current.map((candidate) => {
            if (candidate.id === folder.id) return folderResult.data
            if (candidate.id === swapWith.id) return swapResult.data
            return candidate
          })
        )
      )
    },
    [folders]
  )

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

      if (
        note.id === selectedNoteId &&
        lastSyncedRef.current.id === note.id &&
        lastSyncedRef.current.content !== contentDraft
      ) {
        const saved = await persistNote(note.id, contentDraft)
        if (!saved) return
      }

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
      setNotes((current) =>
        sortNotes(
          current.map((item) =>
            item.id === note.id
              ? {
                  ...item,
                  folderId: result.data.folderId,
                  folderName: nextFolderName,
                  updatedAt: result.data.updatedAt,
                }
              : item
          )
        )
      )
      toast.success(`Moved to ${nextFolderName}`)
    },
    [contentDraft, folders, foldersEnabled, persistNote, selectedNoteId]
  )

  const clearNoteDragState = React.useCallback(() => {
    draggedNoteIdRef.current = null
    if (dragPreviewRef.current) dragPreviewRef.current.textContent = ""
    setDraggedNoteId(null)
    setDragOverFolderId(null)
  }, [])

  const handleNoteDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, note: NoteRecord) => {
      if (
        !foldersEnabled ||
        storageUnavailable ||
        movingNoteId === note.id ||
        getNoteSourceType(note) !== "note"
      ) {
        event.preventDefault()
        return
      }

      draggedNoteIdRef.current = note.id
      setDraggedNoteId(note.id)
      setDragOverFolderId(null)
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", note.id)
      event.dataTransfer.setData("application/x-pixelist-note", note.id)
      const dragPreview = dragPreviewRef.current
      if (dragPreview) {
        dragPreview.textContent = getNoteDisplayTitle(note)
        event.dataTransfer.setDragImage(dragPreview, 12, 18)
      }
    },
    [foldersEnabled, movingNoteId, storageUnavailable]
  )

  const handleFolderDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, folderId: string) => {
      const noteId = draggedNoteIdRef.current
      const note = noteId ? notes.find((item) => item.id === noteId) : null
      if (!note || getNoteSourceType(note) !== "note" || note.folderId === folderId) {
        event.dataTransfer.dropEffect = "none"
        return
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setDragOverFolderId(folderId)
    },
    [notes]
  )

  const handleFolderDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, folderId: string) => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
      setDragOverFolderId((current) => (current === folderId ? null : current))
    },
    []
  )

  const handleFolderDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, folder: NoteFolderRecord) => {
      event.preventDefault()
      const noteId =
        draggedNoteIdRef.current ||
        event.dataTransfer.getData("application/x-pixelist-note") ||
        event.dataTransfer.getData("text/plain")
      const note = notes.find((item) => item.id === noteId)
      clearNoteDragState()

      if (!note || getNoteSourceType(note) !== "note" || note.folderId === folder.id) return

      setMovingNoteId(note.id)
      void handleAssignFolder(note, folder.id).finally(() => {
        setMovingNoteId((current) => (current === note.id ? null : current))
      })
    },
    [clearNoteDragState, handleAssignFolder, notes]
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
        void permanentlyDeleteNote(previousSelectedId)
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

  const handleDelete = React.useCallback(async (note: NoteRecord, permanent = false) => {
    if (getNoteSourceType(note) !== "note") return
    setDeletePermanently(permanent)
    setPendingDeleteNote(note)
  }, [])

  const handleRestore = React.useCallback(async (note: NoteRecord) => {
    if (getNoteSourceType(note) !== "note" || !note.deletedAt) return
    const result = await restoreNote(note.id)
    if (!result.success || !result.data) {
      toast.error(result.error || "Failed to restore note")
      return
    }
    setNotes((current) => upsertNote(current, result.data as NoteRecord))
    setActiveRailKey(result.data.archived ? "archived" : "all")
    setSelectedNoteId(note.id)
    toast.success("Note restored")
  }, [])

  React.useEffect(() => {
    const onWorkspaceKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true"

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault()
        setIsAddingFolder(true)
        setMobilePane("folders")
        return
      }

      if (!isEditing && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        const index = filteredNotes.findIndex((note) => note.id === selectedNoteId)
        const delta = event.key === "ArrowDown" ? 1 : -1
        const nextIndex = Math.min(filteredNotes.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta))
        const nextNote = filteredNotes[nextIndex]
        if (nextNote) {
          event.preventDefault()
          setSelectedNoteId(nextNote.id)
        }
        return
      }

      if (!isEditing && event.key === "Delete" && selectedNote && getNoteSourceType(selectedNote) === "note") {
        event.preventDefault()
        void handleDelete(selectedNote, Boolean(selectedNote.deletedAt))
      }
    }
    window.addEventListener("keydown", onWorkspaceKeyDown)
    return () => window.removeEventListener("keydown", onWorkspaceKeyDown)
  }, [filteredNotes, handleDelete, selectedNote, selectedNoteId])

  const confirmDelete = React.useCallback(async () => {
    if (!pendingDeleteNote) return

    setIsDeletingNote(true)
    try {
      const result = deletePermanently
        ? await permanentlyDeleteNote(pendingDeleteNote.id)
        : await deleteNote(pendingDeleteNote.id)
      if (!result.success) {
        toast.error(result.error || "Failed to delete note")
        return
      }

      if (deletePermanently) {
        setNotes((current) => current.filter((item) => item.id !== pendingDeleteNote.id))
      } else {
        setNotes((current) =>
          current.map((item) =>
            item.id === pendingDeleteNote.id
              ? {
                  ...item,
                  pinned: false,
                  deletedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
        )
      }
      if (selectedNoteId === pendingDeleteNote.id) {
        setSelectedNoteId(filteredNotes.find((candidate) => candidate.id !== pendingDeleteNote.id)?.id ?? null)
      }
      setPendingDeleteNote(null)
      setDeletePermanently(false)
      if (!deletePermanently) toast.success("Moved to Recently Deleted")
    } finally {
      setIsDeletingNote(false)
    }
  }, [deletePermanently, filteredNotes, pendingDeleteNote, selectedNoteId])

  const handleCreateSmartFolder = React.useCallback(async () => {
    const name = smartFolderName.trim()
    if (!name) {
      toast.error("Smart folder name is required")
      return
    }
    const hasCriteria =
      smartFolderTagIds.length > 0 ||
      smartFolderPinned ||
      smartFolderChecklist ||
      smartFolderAttachment ||
      smartFolderUpdatedDays !== "none"
    if (!hasCriteria) {
      toast.error("Choose at least one smart folder rule")
      return
    }

    setIsCreatingSmartFolder(true)
    try {
      const result = await createNoteSmartFolder({
        name,
        matchMode: smartFolderMatchMode,
        tagIds: smartFolderTagIds,
        requirePinned: smartFolderPinned ? true : null,
        requireChecklist: smartFolderChecklist ? true : null,
        requireAttachment: smartFolderAttachment ? true : null,
        updatedWithinDays:
          smartFolderUpdatedDays === "none"
            ? null
            : Number(smartFolderUpdatedDays),
      })
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to create smart folder")
        return
      }
      setSmartFolders((current) =>
        [...current, result.data].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
        )
      )
      setActiveRailKey(`smart:${result.data.id}`)
      setIsSmartFolderDialogOpen(false)
      setSmartFolderName("")
      setSmartFolderTagIds([])
      setSmartFolderPinned(false)
      setSmartFolderChecklist(false)
      setSmartFolderAttachment(false)
      setSmartFolderUpdatedDays("none")
      toast.success("Smart folder created")
    } finally {
      setIsCreatingSmartFolder(false)
    }
  }, [
    smartFolderAttachment,
    smartFolderChecklist,
    smartFolderMatchMode,
    smartFolderName,
    smartFolderPinned,
    smartFolderTagIds,
    smartFolderUpdatedDays,
  ])

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
      "group grid h-9 w-full grid-cols-[minmax(0,1fr)_32px] items-center gap-2 rounded-lg border px-2.5 text-left text-[12px] font-medium transition-colors",
      NOTE_SURFACE_FONT,
      active
        ? "border-[#ead99f] bg-[#fff3bd] text-[#2b2619]"
        : "border-transparent text-[#5f5a50] hover:bg-white/70 hover:text-[#2b2925]"
    )

  const railCountBadgeClass =
    "inline-flex h-6 w-8 shrink-0 items-center justify-center justify-self-end rounded-full bg-white/75 px-1 text-[10px] tabular-nums text-[#7d766a] shadow-[inset_0_0_0_1px_rgba(205,198,185,0.55)]"

  const renderLeftRail = (isMobile = false, compact = false) => (
    <div className={cn(compact ? "flex shrink-0 flex-col" : "flex h-full min-h-0 flex-col", NOTE_SURFACE_FONT)}>
      <div
        className={cn(
          compact
            ? cn("ui-scrollbar overflow-y-auto", isMobile ? "max-h-[44vh]" : "max-h-[min(44vh,420px)]")
            : "ui-scrollbar flex-1 overflow-y-auto",
          isMobile ? "p-3" : "p-2.5"
        )}
      >
        {draggedNoteId ? (
          <span role="status" aria-live="polite" className="sr-only">
            Dragging note. Drop it on another folder to move it.
          </span>
        ) : null}

        {foldersEnabled ? (
          <section
            aria-labelledby={isMobile ? "mobile-note-folders" : "desktop-note-folders"}
          >
            <div
              className={cn(
                "mb-1.5 flex h-9 items-center justify-between rounded-xl px-2 transition-colors",
                draggedNoteId && "border border-[#ddc66f] bg-[#fff3bd] text-[#5e4900]"
              )}
            >
              <h3
                id={isMobile ? "mobile-note-folders" : "desktop-note-folders"}
                className={cn(
                  "inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  draggedNoteId ? "text-[#8a6700]" : "text-[#8f8879]"
                )}
              >
                {draggedNoteId ? <FolderInput className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                <span className="truncate">Folders</span>
              </h3>
              {draggedNoteId ? (
                <FolderInput className="h-4 w-4 shrink-0 text-[#9a7000]" aria-label="Choose a destination folder" />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingFolder((current) => !current)
                    setNewFolderName("")
                    setNewFolderParentId(null)
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[#756f65] transition-colors hover:border-[#d8d0c0] hover:bg-white hover:text-[#302b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300]"
                  disabled={isCreatingFolder || storageUnavailable}
                  aria-label="New folder"
                  title="New folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
              )}
            </div>

            {isAddingFolder ? (
              <div className="mb-1 flex h-10 items-center gap-1 rounded-xl border border-[#ddc66f] bg-white px-1.5">
                <Input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void handleCreateFolder()
                    }
                    if (event.key === "Escape") {
                      event.preventDefault()
                      setNewFolderName("")
                      setNewFolderParentId(null)
                      setIsAddingFolder(false)
                    }
                  }}
                  placeholder={newFolderParentId ? "Subfolder name" : "Folder name"}
                  className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 text-[12px] shadow-none focus-visible:ring-0"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8a6700] hover:bg-[#fff3bd]"
                  disabled={isCreatingFolder || storageUnavailable}
                  aria-label="Create folder"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewFolderName("")
                    setNewFolderParentId(null)
                    setIsAddingFolder(false)
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#f1f3f6]"
                  disabled={isCreatingFolder}
                  aria-label="Cancel new folder"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <div className="space-y-1">
              {folders.map((folder) => {
                const key = folderRailKey(folder.id)
                const active = activeRailKey === key
                const isEditing = editingFolderId === folder.id
                const isDropTarget = dragOverFolderId === folder.id
                const draggedNote = draggedNoteId
                  ? notes.find((note) => note.id === draggedNoteId)
                  : null
                const canAcceptDraggedNote = Boolean(
                  draggedNote &&
                    getNoteSourceType(draggedNote) === "note" &&
                    draggedNote.folderId !== folder.id
                )
                const isCurrentFolder = Boolean(draggedNote && draggedNote.folderId === folder.id)
                const dropState = !draggedNoteId
                  ? "idle"
                  : isDropTarget
                    ? "target"
                    : canAcceptDraggedNote
                      ? "eligible"
                      : "current"
                return (
                  <div
                    key={folder.id}
                    data-note-folder-drop-id={folder.id}
                    data-note-folder-drop-state={dropState}
                    onDragEnter={(event) => handleFolderDragOver(event, folder.id)}
                    onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                    onDragLeave={(event) => handleFolderDragLeave(event, folder.id)}
                    onDrop={(event) => handleFolderDrop(event, folder)}
                    className={cn(
                      "group relative flex h-10 items-center gap-2 rounded-xl border px-2.5 transition-all",
                      folder.parentId && "ml-4",
                      !draggedNoteId && (
                        active
                          ? "border-[#ead99f] bg-[#fff3bd]"
                          : "border-transparent hover:bg-white"
                      ),
                      draggedNoteId && canAcceptDraggedNote && !isDropTarget && "cursor-copy border-dashed border-[#d7b84b] bg-[#fff7d6] ring-1 ring-[#ead99f]",
                      draggedNoteId && isCurrentFolder && "cursor-not-allowed border-[#e1e5eb] bg-[#f1f3f6] opacity-65",
                      isDropTarget && "z-10 scale-[1.015] cursor-copy border-[#b38300] bg-[#ffe884] ring-2 ring-[#e1c24e] shadow-[0_8px_18px_-12px_rgba(125,91,0,0.7)]"
                    )}
                  >
                    {active && !draggedNoteId ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#b38300]" aria-hidden="true" /> : null}
                    {isEditing ? (
                      <>
                        <Folder className="h-4 w-4 shrink-0 text-[#9a7000]" />
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
                          className="h-8 min-w-0 flex-1 rounded-lg border-[#ddc66f] bg-white px-2 text-[12px] shadow-none focus-visible:ring-[#b38300]"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void commitRenameFolder()}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8a6700] hover:bg-[#fff3bd]"
                          disabled={isRenamingFolder}
                          aria-label={`Save folder name ${folder.name}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRenameFolder}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#f1f3f6]"
                          disabled={isRenamingFolder}
                          aria-label={`Cancel renaming ${folder.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                      <button
                        type="button"
                        data-note-view
                        onClick={() => setActiveRailKey(key)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 self-stretch text-left text-[13px] font-medium focus-visible:outline-none",
                          active ? "text-[#17212f]" : "text-[#596577]"
                        )}
                      >
                        {isDropTarget ? (
                          <FolderInput className="h-4 w-4 shrink-0 text-[#8a6700]" />
                        ) : (
                          <Folder
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active || (draggedNoteId && canAcceptDraggedNote) ? "text-[#8a6700]" : "text-[#7c7569]"
                            )}
                          />
                        )}
                        <span className="truncate">{folder.name}</span>
                      </button>
                      {draggedNoteId ? (
                        <span
                          className={cn(
                            "inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-full",
                            isDropTarget && "bg-[#b38300] text-white shadow-sm",
                            canAcceptDraggedNote && !isDropTarget && "border border-[#ddc66f] bg-white text-[#8a6700]",
                            isCurrentFolder && "border border-[#d8dee8] bg-white/80 text-[#7b8796]"
                          )}
                          aria-label={isDropTarget ? "Drop here" : canAcceptDraggedNote ? "Move here" : "Current folder"}
                        >
                          {isDropTarget || canAcceptDraggedNote ? (
                            <FolderInput className="h-3.5 w-3.5" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </span>
                      ) : (
                        <div className="relative h-7 w-8 shrink-0">
                          <span className={cn(railCountBadgeClass, "absolute right-0 top-1/2 -translate-y-1/2 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0")}>
                            {folderCounts.get(folder.id) || 0}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="absolute inset-0 inline-flex items-center justify-center rounded-lg text-[#667085] opacity-0 transition-opacity hover:bg-[#eef1f5] hover:text-[#273344] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 group-hover:opacity-100 data-[state=open]:bg-[#eef1f5] data-[state=open]:opacity-100"
                                aria-label={`Folder actions for ${folder.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[150px] rounded-xl border-[#dfe4eb] bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
                            >
                              {!folder.parentId ? (
                                <DropdownMenuItem
                                  className="rounded-lg px-2.5 py-2 text-[12px]"
                                  onSelect={() => {
                                    setNewFolderParentId(folder.id)
                                    setNewFolderName("")
                                    setIsAddingFolder(true)
                                  }}
                                >
                                  <FolderPlus className="h-3.5 w-3.5" />
                                  New Subfolder
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                className="rounded-lg px-2.5 py-2 text-[12px]"
                                onSelect={() => startRenameFolder(folder)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg px-2.5 py-2 text-[12px]"
                                onSelect={() => void reorderFolder(folder, -1)}
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                                Move Up
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg px-2.5 py-2 text-[12px]"
                                onSelect={() => void reorderFolder(folder, 1)}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                                Move Down
                              </DropdownMenuItem>
                              {!folder.isDefault ? (
                                <>
                                  <DropdownMenuSeparator className="bg-[#e7eaf0]" />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    className="rounded-lg px-2.5 py-2 text-[12px]"
                                    onSelect={() => setPendingDeleteFolder(folder)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby={isMobile ? "mobile-note-collections" : "desktop-note-collections"}
          className="mt-3 border-t border-[#e3e7ed] pt-2.5"
        >
          <div className="mb-1.5 flex h-7 items-center px-2">
            <h3
              id={isMobile ? "mobile-note-collections" : "desktop-note-collections"}
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]"
            >
              Collections
            </h3>
          </div>
          <div className="space-y-1">
            <button data-note-view type="button" onClick={() => setActiveRailKey("all")} className={railButtonClass(activeRailKey === "all")}>
              <span className="inline-flex min-w-0 items-center gap-2"><NotebookPen className="h-4 w-4 shrink-0" /><span className="truncate">All Notes</span></span>
              <span className={railCountBadgeClass}>{smartCollectionCounts.all}</span>
            </button>
            <button data-note-view type="button" onClick={() => setActiveRailKey("pinned")} className={railButtonClass(activeRailKey === "pinned")}>
              <span className="inline-flex min-w-0 items-center gap-2"><Pin className="h-4 w-4 shrink-0" /><span className="truncate">Pinned</span></span>
              <span className={railCountBadgeClass}>{smartCollectionCounts.pinned}</span>
            </button>
            <button data-note-view type="button" onClick={() => setActiveRailKey("archived")} className={railButtonClass(activeRailKey === "archived")}>
              <span className="inline-flex min-w-0 items-center gap-2"><Archive className="h-4 w-4 shrink-0" /><span className="truncate">Archived</span></span>
              <span className={railCountBadgeClass}>{smartCollectionCounts.archived}</span>
            </button>
            <button data-note-view type="button" onClick={() => setActiveRailKey("deleted")} className={railButtonClass(activeRailKey === "deleted")}>
              <span className="inline-flex min-w-0 items-center gap-2"><Trash2 className="h-4 w-4 shrink-0" /><span className="truncate">Recently Deleted</span></span>
              <span className={railCountBadgeClass}>{smartCollectionCounts.deleted}</span>
            </button>
          </div>
        </section>

        {productivityFeaturesEnabled ? (
          <section className="mt-3 border-t border-[#ddd8cc] pt-2.5" aria-label="Smart Folders and Tags">
            <div className="mb-1.5 flex h-7 items-center justify-between px-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8879]">
                Smart Folders &amp; Tags
              </h3>
              <button
                type="button"
                onClick={() => setIsSmartFolderDialogOpen(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#756f65] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300]"
                aria-label="New smart folder"
                title="New smart folder"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {smartFolders.map((folder) => {
                const key = `smart:${folder.id}` as RailKey
                const count = notes.filter(
                  (note) =>
                    getNoteSourceType(note) === "note" &&
                    !note.archived &&
                    !note.deletedAt &&
                    matchesNoteSmartFolder(
                      {
                        pinned: note.pinned,
                        hasChecklist: Boolean(note.hasChecklist),
                        hasAttachment: Boolean(note.hasAttachment),
                        updatedAt: note.updatedAt,
                        tagIds: (note.tags || []).map((tag) => tag.id),
                      },
                      {
                        matchMode: folder.matchMode,
                        requirePinned: folder.requirePinned,
                        requireChecklist: folder.requireChecklist,
                        requireAttachment: folder.requireAttachment,
                        updatedWithinDays: folder.updatedWithinDays as 1 | 7 | 30 | 90 | null,
                        tagIds: folder.tags.map((tag) => tag.id),
                      }
                    )
                ).length
                return (
                  <button data-note-view key={folder.id} type="button" onClick={() => setActiveRailKey(key)} className={railButtonClass(activeRailKey === key)}>
                    <span className="inline-flex min-w-0 items-center gap-2"><Sparkles className="h-4 w-4 shrink-0" /><span className="truncate">{folder.name}</span></span>
                    <span className={railCountBadgeClass}>{count}</span>
                  </button>
                )
              })}
              {tags.map((tag) => {
                const key = `tag:${tag.id}` as RailKey
                return (
                  <button data-note-view key={tag.id} type="button" onClick={() => setActiveRailKey(key)} className={railButtonClass(activeRailKey === key)}>
                    <span className="inline-flex min-w-0 items-center gap-2"><Hash className="h-4 w-4 shrink-0" /><span className="truncate">{tag.name}</span></span>
                    <span className={railCountBadgeClass}>{tagCounts.get(tag.id) || 0}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-3 border-t border-[#ddd8cc] pt-2.5" aria-label="Linked Notes">
          <div className="mb-1.5 flex h-7 items-center px-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8f8879]">
              Linked Notes
            </h3>
          </div>
          <div className="space-y-1">
            <button data-note-view type="button" onClick={() => setActiveRailKey("projects")} className={railButtonClass(activeRailKey === "projects")}>
              <span className="inline-flex min-w-0 items-center gap-2"><FolderKanban className="h-4 w-4 shrink-0" /><span className="truncate">Project Notes</span></span>
              <span className={railCountBadgeClass}>{smartCollectionCounts.projects}</span>
            </button>
            <button data-note-view type="button" onClick={() => setActiveRailKey("tasks")} className={railButtonClass(activeRailKey === "tasks")}>
              <span className="inline-flex min-w-0 items-center gap-2"><ListTodo className="h-4 w-4 shrink-0" /><span className="truncate">Task Notes</span></span>
              <span className={railCountBadgeClass}>{smartCollectionCounts.tasks}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )

  const renderMiddleList = (isMobile = false) => (
    <div className={cn("flex h-full min-h-0 flex-col", NOTE_SURFACE_FONT)}>
      <div className="border-b border-[#ddd8ce] bg-[#f7f5f0] px-3 pb-3 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#2b2925]">
              {searchQuery ? "Search Results" : activeRailLabel}
            </p>
            <p className="text-[11px] tabular-nums text-[#8f887c]">
              {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setListMode((current) => (current === "list" ? "gallery" : "list"))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#756d5d] hover:bg-[#ece8df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300]"
              aria-label={listMode === "list" ? "Show gallery" : "Show list"}
              title={listMode === "list" ? "Gallery view" : "List view"}
            >
              {listMode === "list" ? <Grid2X2 className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#756d5d] hover:bg-[#ece8df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300]"
                  aria-label="Sort notes"
                  title="Sort notes"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onSelect={() => setNoteSort("modified")}>
                  <Check className={cn("h-4 w-4", noteSort !== "modified" && "opacity-0")} />
                  Date edited
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNoteSort("created")}>
                  <Check className={cn("h-4 w-4", noteSort !== "created" && "opacity-0")} />
                  Date created
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setNoteSort("title")}>
                  <Check className={cn("h-4 w-4", noteSort !== "title" && "opacity-0")} />
                  Title
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <NotesSearchInput
          ref={searchRef}
          value={search}
          onChange={setSearch}
          showShortcutHint={!isMobile}
          variant="apple"
          density="compact"
        />
        <div className="mt-2 grid grid-cols-2 rounded-lg bg-[#eae6dd] p-0.5 text-[11px] font-medium">
          <button
            type="button"
            className={cn(
              "rounded-md px-2 py-1.5 transition-colors",
              searchScope === "view" ? "bg-white text-[#373126] shadow-sm" : "text-[#756f65]"
            )}
            onClick={() => setSearchScope("view")}
          >
            Current View
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-2 py-1.5 transition-colors",
              searchScope === "all" ? "bg-white text-[#373126] shadow-sm" : "text-[#756f65]"
            )}
            onClick={() => setSearchScope("all")}
          >
            All Notes
          </button>
        </div>
      </div>
      <div
        data-notes-list
        className={cn("ui-scrollbar flex-1 overflow-y-auto", isMobile ? "p-3" : "p-2.5")}
      >
        {groupedNotes.length ? (
          <div className="space-y-4">
            {groupedNotes.map((group) => (
              <div key={group.key}>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">{group.label}</p>
                <div className={cn("mt-1.5", listMode === "gallery" ? "grid grid-cols-2 gap-2" : "space-y-1")}>
                  {group.notes.map((note) => {
                    const selected = note.id === selectedNoteId
                    const sourceType = getNoteSourceType(note)
                    const imageSrc = extractFirstImageSrc(note.content || "")
                    const isLinked = sourceType !== "note"
                    return (
                      <div
                        key={note.id}
                        data-note-drag-id={note.id}
                        draggable={!isLinked && !note.deletedAt && foldersEnabled && !storageUnavailable && movingNoteId !== note.id}
                        onDragStart={(event) => handleNoteDragStart(event, note)}
                        onDragEnd={clearNoteDragState}
                        onContextMenu={(event) => {
                          if (isLinked) return
                          event.preventDefault()
                          setSelectedNoteId(note.id)
                          setRowMenuNoteId(note.id)
                        }}
                        onClick={() => {
                          setSelectedNoteId(note.id)
                          if (isMobile) setMobilePane("editor")
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedNoteId(note.id)
                            if (isMobile) setMobilePane("editor")
                          }
                        }}
                        className={cn(
                          "group rounded-[9px] border border-transparent px-2.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300]",
                          !isLinked && !note.deletedAt && foldersEnabled && !storageUnavailable && "cursor-grab active:cursor-grabbing",
                          selected ? "border-[#ead99f] bg-[#fff0ad]" : "hover:bg-[#efede8]",
                          draggedNoteId === note.id && "scale-[0.99] opacity-45",
                          movingNoteId === note.id && "pointer-events-none opacity-55",
                          listMode === "gallery" && "min-h-[132px] p-3"
                        )}
                        aria-label={
                          isLinked
                            ? `Open ${getNoteDisplayTitle(note)}`
                            : `${getNoteDisplayTitle(note)}. Drag to move to another folder.`
                        }
                      >
                        <div className="flex items-start gap-2.5">
                          {imageSrc ? (
                            <div className={cn("mt-0.5 shrink-0 overflow-hidden rounded-lg bg-[#e9edf2]", listMode === "gallery" ? "h-16 w-16" : "h-10 w-10")}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={imageSrc} alt="Note preview" className="h-full w-full object-cover" />
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-[14px] font-semibold tracking-[-0.01em] text-[#1f2937]">{getNoteDisplayTitle(note)}</p>
                            <p className="mt-0.5 line-clamp-1 text-[12px] text-[#667085]">{getNotePreview(note)}</p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <p className="truncate text-[11px] text-[#98a2b3]">{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}</p>
                              <div className="flex items-center gap-0.5">
                                {!isLinked ? (
                                  <DropdownMenu
                                    open={rowMenuNoteId === note.id}
                                    onOpenChange={(open) =>
                                      setRowMenuNoteId(open ? note.id : null)
                                    }
                                  >
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(event) => event.stopPropagation()}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#746f66] opacity-0 hover:bg-white/70 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                                        aria-label={`Actions for ${getNoteDisplayTitle(note)}`}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {note.deletedAt ? (
                                        <>
                                          <DropdownMenuItem onSelect={() => void handleRestore(note)}>
                                            <RotateCcw className="h-4 w-4" />
                                            Restore
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onSelect={() => void handleDelete(note, true)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Delete Permanently
                                          </DropdownMenuItem>
                                        </>
                                      ) : (
                                        <>
                                          <DropdownMenuItem onSelect={() => void handlePinToggle(note)}>
                                            {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                            {note.pinned ? "Unpin" : "Pin"}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onSelect={() => void handleArchiveToggle(note)}>
                                            {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                            {note.archived ? "Unarchive" : "Archive"}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onSelect={() => void handleDelete(note)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Move to Recently Deleted
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
    if (activeRailKey === "deleted") return "Recently Deleted"
    if (activeRailKey === "projects") return "Project Notes"
    if (activeRailKey === "tasks") return "Task Notes"
    if (activeRailKey.startsWith("tag:")) {
      const tagId = activeRailKey.slice("tag:".length)
      return tags.find((tag) => tag.id === tagId)?.name || "Tag"
    }
    if (activeRailKey.startsWith("smart:")) {
      const folderId = activeRailKey.slice("smart:".length)
      return smartFolders.find((folder) => folder.id === folderId)?.name || "Smart Folder"
    }
    const folderId = getFolderIdFromRailKey(activeRailKey)
    if (!folderId) return "Notes"
    return folders.find((folder) => folder.id === folderId)?.name || "Folder"
  }, [activeRailKey, folders, smartFolders, tags])

  const renderEditor = (isMobile = false) => {
    if (!selectedNote) {
      return (
        <div className="flex h-full min-h-0 flex-col bg-white">
          <div className="flex h-12 items-center border-b border-[#e2ded5] px-5 text-[12px] text-[#8c8579]">
            {activeRailLabel}
          </div>
          <div className="ui-scrollbar flex-1 overflow-y-auto px-5 py-5 lg:px-8">
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
              className="bg-transparent"
              minHeightClassName="min-h-[60vh]"
            />
          </div>
        </div>
      )
    }

    const isDeleted = Boolean(selectedNote.deletedAt)
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#e2ded5] px-4 py-2 lg:px-6">
          <div className="min-w-0 text-[11px] text-[#8c8579]">
            <span>
              Edited {format(new Date(selectedNote.updatedAt), "d MMM yyyy, HH:mm")}
            </span>
            {saveState === "saving" ? <span className="ml-2 text-[#9a7000]">Saving…</span> : null}
            {saveState === "error" ? <span className="ml-2 text-rose-600">Save failed</span> : null}
            {isDeleted ? <span className="ml-2 font-medium text-rose-600">Recently Deleted</span> : null}
          </div>
          {!selectedNoteIsLinked ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#746f66] hover:bg-[#f0ede7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300]"
                  aria-label="Note actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                {isDeleted ? (
                  <>
                    <DropdownMenuItem onSelect={() => void handleRestore(selectedNote)}>
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void handleDelete(selectedNote, true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Permanently
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => void handlePinToggle(selectedNote)}>
                      {selectedNote.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {selectedNote.pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleArchiveToggle(selectedNote)}>
                      {selectedNote.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {selectedNote.archived ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                    {foldersEnabled ? (
                      <>
                        <DropdownMenuSeparator />
                        {folders.map((folder) => (
                          <DropdownMenuItem
                            key={folder.id}
                            onSelect={() => void handleAssignFolder(selectedNote, folder.id)}
                          >
                            <FolderInput className="h-4 w-4" />
                            Move to {folder.name}
                            {selectedNote.folderId === folder.id ? <Check className="ml-auto h-4 w-4" /> : null}
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void handleDelete(selectedNote)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Move to Recently Deleted
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="rounded-md bg-[#f0eee9] px-2 py-1 text-[10px] font-medium text-[#746f66]">
              {selectedNoteSourceType === "project" ? "Project" : "Task"}
              {selectedNote.sourceLabel ? ` · ${selectedNote.sourceLabel}` : ""}
            </span>
          )}
        </div>
        <div className={cn("ui-scrollbar ui-scrollbar-inset flex-1 min-h-0 overflow-y-auto", isMobile ? "px-3 pb-16 pt-3" : "px-6 py-4 lg:px-9")}>
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
            readOnly={isDeleted}
            toolbarActions={
              selectedNoteIsLinked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={appendTemplate}
                  className="h-8 w-8 rounded-full text-[#756f65] hover:bg-[#f0ede7]"
                  aria-label="Add template"
                  title="Add template"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              ) : undefined
            }
            className="bg-transparent"
            minHeightClassName="min-h-[62vh]"
          />
        </div>
      </div>
    )
  }

  const showArchivedMode = activeRailKey === "archived"

  return (
    <div className={cn("flex h-[calc(100dvh-7.2rem-env(safe-area-inset-bottom))] min-h-[calc(100dvh-7.2rem-env(safe-area-inset-bottom))] flex-col gap-3 overflow-hidden lg:h-[calc(100dvh-3.5rem)] lg:min-h-[calc(100dvh-3.5rem)]", NOTE_SURFACE_FONT)}>
      <div
        ref={dragPreviewRef}
        data-note-drag-preview
        aria-hidden="true"
        className="pointer-events-none fixed -top-[1000px] left-0 z-50 inline-flex h-9 w-max max-w-[240px] items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-[#d8dee8] bg-white px-3 text-[13px] font-semibold text-[#1f2937] shadow-[0_8px_20px_rgba(15,23,42,0.16)]"
      />
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#d8d3ca] bg-[#f7f5f0] px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <NotebookPen className="h-5 w-5 shrink-0 text-[#9a7000]" />
          <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#292722]">
            Notes
          </h1>
        </div>
        <Button
          type="button"
          className="h-9 rounded-lg border border-[#d7be65] bg-[#ffd84d] px-3 text-[#3b3010] shadow-none hover:bg-[#f4ca37]"
          onClick={() => {
            void handleCreateNote({ content: "" }).then((id) => {
              if (id) setMobilePane("editor")
            })
          }}
          disabled={isCreating || storageUnavailable || activeRailKey === "deleted"}
        >
          <FilePlus2 className="h-4 w-4" />
          New Note
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden border border-[#d8d3ca] bg-white xl:grid"
        style={{
          gridTemplateColumns: `${sidebarWidth}px 5px ${listWidth}px 5px minmax(520px, 1fr)`,
        }}
      >
        <NotesSidebarPane className="hidden xl:block">
          {renderLeftRail(false, false)}
        </NotesSidebarPane>
        <button
          type="button"
          aria-label="Resize folders pane"
          className="hidden cursor-col-resize border-x border-[#d8d3ca] bg-[#e8e4dc] hover:bg-[#d9b843] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300] xl:block"
          onPointerDown={(event) => beginPaneResize(event, "sidebar")}
        />
        <NotesListPane className="hidden xl:block">
          {renderMiddleList(false)}
        </NotesListPane>
        <button
          type="button"
          aria-label="Resize notes list"
          className="hidden cursor-col-resize border-x border-[#d8d3ca] bg-[#e8e4dc] hover:bg-[#d9b843] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38300] xl:block"
          onPointerDown={(event) => beginPaneResize(event, "list")}
        />
        <NotesEditorPane className="hidden xl:block">
          {renderEditor(false)}
        </NotesEditorPane>

        <div className="hidden h-full min-h-0 md:grid md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] xl:hidden">
          <NotesListPane className="border-r border-[#d8d3ca]">
            <div className="flex h-10 items-center border-b border-[#d8d3ca] px-2">
              <Sheet open={tabletSidebarOpen} onOpenChange={setTabletSidebarOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-[#615b50]">
                    <PanelLeft className="h-4 w-4" />
                    Folders
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] border-r border-[#d8d3ca] bg-[#efede8] p-0">
                  <SheetHeader className="border-b border-[#d8d3ca] px-4 py-3">
                    <SheetTitle>Notes</SheetTitle>
                  </SheetHeader>
                  <div
                    className="h-[calc(100dvh-60px)]"
                    onClickCapture={(event) => {
                      if ((event.target as HTMLElement).closest("[data-note-view]")) {
                        setTabletSidebarOpen(false)
                      }
                    }}
                  >
                    {renderLeftRail(false, false)}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="h-[calc(100%-40px)]">{renderMiddleList(false)}</div>
          </NotesListPane>
          <NotesEditorPane>{renderEditor(false)}</NotesEditorPane>
        </div>

        <div className="h-full min-h-0 md:hidden">
          {mobilePane === "folders" ? (
            <section className="h-full bg-[#efede8]">
              <div className="flex h-11 items-center justify-between border-b border-[#d8d3ca] px-3">
                <span className="text-[15px] font-semibold text-[#2d2922]">Folders</span>
                <span className="text-[11px] text-[#8a8378]">{smartCollectionCounts.all} notes</span>
              </div>
              <div
                className="h-[calc(100%-44px)]"
                onClickCapture={(event) => {
                  if ((event.target as HTMLElement).closest("[data-note-view]")) {
                    setMobilePane("list")
                  }
                }}
              >
                {renderLeftRail(true, false)}
              </div>
            </section>
          ) : null}
          {mobilePane === "list" ? (
            <section className="flex h-full min-h-0 flex-col bg-[#f7f5f0]">
              <div className="flex h-11 shrink-0 items-center border-b border-[#d8d3ca] px-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[#8a6700]" onClick={() => setMobilePane("folders")}>
                  <ChevronLeft className="h-4 w-4" />
                  Folders
                </Button>
              </div>
              <div className="min-h-0 flex-1">{renderMiddleList(true)}</div>
            </section>
          ) : null}
          {mobilePane === "editor" ? (
            <section className="flex h-full min-h-0 flex-col bg-white">
              <div className="flex h-11 shrink-0 items-center border-b border-[#d8d3ca] px-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[#8a6700]" onClick={() => setMobilePane("list")}>
                  <ChevronLeft className="h-4 w-4" />
                  Notes
                </Button>
              </div>
              <div className="min-h-0 flex-1">{renderEditor(true)}</div>
            </section>
          ) : null}
        </div>
      </main>

      {false ? (
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
      ) : null}

      {false ? (
      <Card className="flex-1 min-h-0 gap-0 overflow-hidden rounded-[20px] border border-[#e7eaf0] bg-[#fbfbfc] py-0 shadow-[0_12px_28px_-30px_rgba(15,23,42,0.52)]">
        <CardContent className="flex-1 min-h-0 p-0">
          <div className="hidden h-full min-h-0 md:grid md:grid-cols-[312px_minmax(0,1fr)] xl:grid-cols-[336px_minmax(0,1fr)]">
            <aside className="min-h-0 border-r border-[#e8eaee] bg-[#f7f8fa]">
              <div className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1">
                  {renderMiddleList(false)}
                </div>
                <div className="shrink-0 border-t border-[#e8eaee]">
                  {renderLeftRail(false, true)}
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
                        <span>{format(new Date(selectedNote!.updatedAt), "d MMMM yyyy 'at' HH:mm")}</span>
                        <span>•</span>
                        <span>{activeRailLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedNoteIsLinked && foldersEnabled ? (
                          <Select
                            value={selectedNote!.folderId || (defaultFolder?.id ?? NO_FOLDER_VALUE)}
                            onValueChange={(value) => {
                              void handleAssignFolder(selectedNote!, value === NO_FOLDER_VALUE ? null : value)
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
                            {selectedNote!.sourceLabel ? ` · ${selectedNote!.sourceLabel}` : ""}
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
                    <div className="min-h-0 flex-1">
                      {renderMiddleList(true)}
                    </div>
                    <div className="shrink-0 border-t border-[#e8eaee]">
                      {renderLeftRail(true, true)}
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
                        <span>{formatDistanceToNow(new Date(selectedNote!.updatedAt), { addSuffix: true })}</span>
                        <span>•</span>
                        <span className="truncate">{activeRailLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedNoteIsLinked && foldersEnabled ? (
                          <Select
                            value={selectedNote!.folderId || (defaultFolder?.id ?? NO_FOLDER_VALUE)}
                            onValueChange={(value) => {
                              void handleAssignFolder(selectedNote!, value === NO_FOLDER_VALUE ? null : value)
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
                            {selectedNote!.sourceLabel ? ` · ${selectedNote!.sourceLabel}` : ""}
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
      ) : null}

      <Dialog open={isSmartFolderDialogOpen} onOpenChange={setIsSmartFolderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Smart Folder</DialogTitle>
            <DialogDescription>
              Automatically collect notes that match these rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={smartFolderName}
              onChange={(event) => setSmartFolderName(event.target.value)}
              placeholder="Smart folder name"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={smartFolderMatchMode}
                onValueChange={(value) => setSmartFolderMatchMode(value as "all" | "any")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Match all rules</SelectItem>
                  <SelectItem value="any">Match any rule</SelectItem>
                </SelectContent>
              </Select>
              <Select value={smartFolderUpdatedDays} onValueChange={setSmartFolderUpdatedDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any edited date</SelectItem>
                  <SelectItem value="1">Edited in 1 day</SelectItem>
                  <SelectItem value="7">Edited in 7 days</SelectItem>
                  <SelectItem value="30">Edited in 30 days</SelectItem>
                  <SelectItem value="90">Edited in 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Pinned", smartFolderPinned, setSmartFolderPinned],
                ["Checklist", smartFolderChecklist, setSmartFolderChecklist],
                ["Attachment", smartFolderAttachment, setSmartFolderAttachment],
              ].map(([label, checked, setter]) => (
                <label key={String(label)} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#ded8cb] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={(event) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)}
                    className="accent-[#b38300]"
                  />
                  {String(label)}
                </label>
              ))}
            </div>
            {tags.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-[#70695d]">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = smartFolderTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setSmartFolderTagIds((current) =>
                            selected
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id]
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          selected
                            ? "border-[#c7a62f] bg-[#fff0ad] text-[#4a3a00]"
                            : "border-[#ded8cb] bg-white text-[#70695d]"
                        )}
                      >
                        #{tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSmartFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#ffd84d] text-[#3b3010] hover:bg-[#f4ca37]"
              onClick={() => void handleCreateSmartFolder()}
              disabled={isCreatingSmartFolder}
            >
              {isCreatingSmartFolder ? "Creating…" : "Create Smart Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteNote)}
        onOpenChange={(open) => {
          if (!open && !isDeletingNote) {
            setPendingDeleteNote(null)
            setDeletePermanently(false)
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-50 text-rose-600">
              <Trash2 className="h-7 w-7" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {deletePermanently ? "Permanently delete note?" : "Move note to Recently Deleted?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteNote
                ? deletePermanently
                  ? `"${getNoteDisplayTitle(pendingDeleteNote)}" cannot be recovered after this action.`
                  : `"${getNoteDisplayTitle(pendingDeleteNote)}" can be restored for 30 days.`
                : deletePermanently
                  ? "This note cannot be recovered."
                  : "This note can be restored for 30 days."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingNote}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={isDeletingNote}>
              {isDeletingNote
                ? "Deleting..."
                : deletePermanently
                  ? "Delete Permanently"
                  : "Move to Deleted"}
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
