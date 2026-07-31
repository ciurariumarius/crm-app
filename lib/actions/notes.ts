"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { DEFAULT_NOTE_TITLE, deriveNoteTitleFromContent } from "@/lib/notes/derived-note-text"
import {
  NOTE_UPDATED_WITHIN_OPTIONS,
  deriveNoteContentFeatures,
  extractNoteTagNames,
  isValidUpdatedWithinDays,
  type NoteSmartFolderMatchMode,
} from "@/lib/notes/apple-notes"
import { runDeletedNotesRetention } from "@/lib/notes/retention.server"
import {
  getNotesWorkspaceBootstrap,
  getPersonalNoteDetail,
  queryPersonalNoteList,
  type NoteListQueryInput,
} from "@/lib/notes/queries.server"

export type NoteTagRecord = {
  id: string
  name: string
  normalizedName: string
  count?: number
}

export type NoteRecord = {
  id: string
  folderId?: string | null
  folderName?: string | null
  title: string
  content: string
  contentText: string
  archived: boolean
  pinned: boolean
  deletedAt?: string | null
  hasChecklist?: boolean
  hasAttachment?: boolean
  tags?: NoteTagRecord[]
  createdAt: string
  updatedAt: string
  sourceType?: "note" | "project" | "task"
  sourceId?: string
  sourceProjectId?: string
  sourceLabel?: string
}

export type NoteFolderRecord = {
  id: string
  parentId?: string | null
  name: string
  isDefault: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

export type NoteSmartFolderRecord = {
  id: string
  name: string
  matchMode: NoteSmartFolderMatchMode
  requirePinned: boolean | null
  requireChecklist: boolean | null
  requireAttachment: boolean | null
  updatedWithinDays: number | null
  sortOrder: number
  tags: NoteTagRecord[]
  count?: number
  createdAt: string
  updatedAt: string
}

type NoteEntity = {
  id: string
  folderId: string | null
  title: string
  content: string
  contentText: string
  archived: boolean
  pinned: boolean
  deletedAt?: Date | null
  hasChecklist?: boolean
  hasAttachment?: boolean
  tags?: Array<{
    tag: {
      id: string
      name: string
      normalizedName: string
    }
  }>
  createdAt: Date
  updatedAt: Date
}

type NoteDelegate = {
  findMany: (args: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
  findFirst: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
  updateMany: (args: unknown) => Promise<unknown>
  delete: (args: unknown) => Promise<unknown>
}

type NoteFolderEntity = {
  id: string
  parentId?: string | null
  name: string
  isDefault: boolean
  sortOrder?: number
  createdAt: Date
  updatedAt: Date
}

type NoteFolderDelegate = {
  findMany: (args: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<unknown>
  findFirst: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
  updateMany: (args: unknown) => Promise<unknown>
  delete: (args: unknown) => Promise<unknown>
}

function getNoteDelegate() {
  const delegate = (prisma as unknown as { note?: NoteDelegate }).note

  if (!delegate || typeof delegate.findMany !== "function") return null
  return delegate
}

function getNoteFolderDelegate() {
  const delegate = (prisma as unknown as { noteFolder?: NoteFolderDelegate }).noteFolder

  if (!delegate || typeof delegate.findMany !== "function") return null
  return delegate
}

const NOTES_STORAGE_NOT_READY_ERROR =
  "Notes storage is not ready yet. Run `npx prisma generate` + `npx prisma migrate deploy`, then restart the app."
const DEFAULT_NOTES_FOLDER_NAME = "General"

const NoteIdSchema = z.string().trim().min(1, "Invalid note id")

const CreateNoteSchema = z.object({
  title: z.string().trim().max(240).optional(),
  content: z.string().max(200000).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  folderId: z.string().trim().min(1).max(120).nullable().optional(),
})

const UpdateNoteSchema = z.object({
  title: z.string().trim().max(240).optional(),
  content: z.string().max(200000).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  folderId: z.string().trim().min(1).max(120).nullable().optional(),
})

const ListNotesSchema = z.object({
  query: z.string().trim().max(200).optional(),
  archived: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

const CreateFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().trim().min(1).max(120).nullable().optional(),
})

const RenameFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

const MoveFolderSchema = z.object({
  parentId: z.string().trim().min(1).max(120).nullable(),
  sortOrder: z.number().int().min(0).max(1_000_000),
})

const SmartFolderInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    matchMode: z.enum(["all", "any"]).default("all"),
    tagIds: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    requirePinned: z.boolean().nullable().default(null),
    requireChecklist: z.boolean().nullable().default(null),
    requireAttachment: z.boolean().nullable().default(null),
    updatedWithinDays: z.number().int().nullable().default(null),
  })

  .superRefine((value, context) => {
    if (!isValidUpdatedWithinDays(value.updatedWithinDays)) {
      context.addIssue({
        code: "custom",
        path: ["updatedWithinDays"],
        message: `Use one of ${NOTE_UPDATED_WITHIN_OPTIONS.join(", ")} days`,
      })
    }
    const hasCriteria =
      value.tagIds.length > 0 ||
      value.requirePinned != null ||
      value.requireChecklist != null ||
      value.requireAttachment != null ||
      value.updatedWithinDays != null
    if (!hasCriteria) {
      context.addIssue({
        code: "custom",
        message: "Choose at least one smart folder rule",
      })
    }
  })

export async function queryNoteList(input: NoteListQueryInput = {}) {
  try {
    await requireAuth()
    const data = await queryPersonalNoteList(input)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to load notes") }
  }
}

export async function queryNoteRecordPage(input: NoteListQueryInput = {}) {
  try {
    await requireAuth()
    const page = await queryPersonalNoteList(input)
    const ids = page.rows.map((row) => row.id)
    const records = ids.length
      ? await prisma.note.findMany({
          where: { id: { in: ids } },
          include: {
            folder: { select: { name: true } },
            tags: {
              include: { tag: true },
              orderBy: { tag: { normalizedName: "asc" } },
            },
          },
        })
      : []
    const byId = new Map(
      records.map((note) => [
        note.id,
        {
          ...serializeNote(note),
          folderName: note.folder?.name ?? null,
          sourceType: "note" as const,
        },
      ])
    )
    return {
      success: true,
      data: {
        notes: ids.flatMap((id) => {
          const note = byId.get(id)
          return note ? [note] : []
        }),
        nextCursor: page.nextCursor,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to load notes"),
    }
  }
}

export async function getNoteDetail(noteId: string) {
  try {
    await requireAuth()
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const data = await getPersonalNoteDetail(validatedNoteId)
    return data
      ? { success: true, data }
      : { success: false, error: "Note not found" }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to load note") }
  }
}

export async function getNotesWorkspaceBootstrapAction() {
  try {
    await requireAuth()
    const data = await getNotesWorkspaceBootstrap()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to load Notes workspace") }
  }
}

function normalizeNoteTitle(value: string | null | undefined) {
  const title = (value || "").trim()
  if (!title) return DEFAULT_NOTE_TITLE
  if (title.toLowerCase() === "untitled" || title.toLowerCase() === "untitled note") {
    return DEFAULT_NOTE_TITLE
  }
  return title
}

function toNoteContentText(content: string) {
  const withoutTags = content.replace(/<[^>]*>/g, " ")
  return withoutTags.replace(/\s+/g, " ").trim()
}

function serializeNote(note: NoteEntity): NoteRecord {
  return {
    id: note.id,
    folderId: note.folderId,
    title: note.title,
    content: note.content,
    contentText: note.contentText,
    archived: note.archived,
    pinned: note.pinned,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    hasChecklist: note.hasChecklist ?? false,
    hasAttachment: note.hasAttachment ?? /<img\b/i.test(note.content),
    tags:
      note.tags?.map(({ tag }) => ({
        id: tag.id,
        name: tag.name,
        normalizedName: tag.normalizedName,
      })) ?? [],
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

function serializeFolder(folder: NoteFolderEntity): NoteFolderRecord {
  return {
    id: folder.id,
    parentId: folder.parentId ?? null,
    name: folder.name,
    isDefault: folder.isDefault,
    sortOrder: folder.sortOrder ?? 1000,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  }
}

function serializeSmartFolder(smartFolder: {
  id: string
  name: string
  matchMode: string
  requirePinned: boolean | null
  requireChecklist: boolean | null
  requireAttachment: boolean | null
  updatedWithinDays: number | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  tags?: Array<{
    tag: {
      id: string
      name: string
      normalizedName: string
    }
  }>
}): NoteSmartFolderRecord {
  return {
    id: smartFolder.id,
    name: smartFolder.name,
    matchMode: smartFolder.matchMode === "any" ? "any" : "all",
    requirePinned: smartFolder.requirePinned,
    requireChecklist: smartFolder.requireChecklist,
    requireAttachment: smartFolder.requireAttachment,
    updatedWithinDays: smartFolder.updatedWithinDays,
    sortOrder: smartFolder.sortOrder,
    tags:
      smartFolder.tags?.map(({ tag }) => ({
        id: tag.id,
        name: tag.name,
        normalizedName: tag.normalizedName,
      })) ?? [],
    createdAt: smartFolder.createdAt.toISOString(),
    updatedAt: smartFolder.updatedAt.toISOString(),
  }
}

async function findSerializedNote(noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      tags: {
        include: { tag: true },
        orderBy: { tag: { normalizedName: "asc" } },
      },
    },
  })
  return note ? serializeNote(note) : null
}

async function syncNoteContentMetadata(noteId: string, content: string) {
  const contentText = toNoteContentText(content)
  const features = deriveNoteContentFeatures(content)
  const tagNames = extractNoteTagNames(contentText)

  await prisma.$transaction(async (transaction) => {
    await transaction.note.update({
      where: { id: noteId },
      data: {
        content,
        contentText,
        title: deriveNoteTitleFromContent(content, DEFAULT_NOTE_TITLE),
        hasChecklist: features.hasChecklist,
        hasAttachment: features.hasAttachment,
      },
    })

    const tagIds: string[] = []
    for (const tagName of tagNames) {
      const tag = await transaction.noteTag.upsert({
        where: { normalizedName: tagName.normalizedName },
        update: {},
        create: {
          name: tagName.name,
          normalizedName: tagName.normalizedName,
        },
      })
      tagIds.push(tag.id)
    }

    await transaction.noteTagAssignment.deleteMany({
      where: { noteId },
    })
    if (tagIds.length) {
      await transaction.noteTagAssignment.createMany({
        data: tagIds.map((tagId) => ({ noteId, tagId })),
      })
    }
  })
}

function isUnknownFolderFieldError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return message.includes("Unknown argument `folderId`") || message.includes("Unknown field `folderId`")
}

async function resolveDefaultFolderId(
  folderDelegate: NoteFolderDelegate
) {
  const folders = (await folderDelegate.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, isDefault: true },
  })) as Array<{ id: string; name: string; isDefault: boolean }>

  const existingDefault = folders.find((folder) => folder.isDefault)
  if (existingDefault) return existingDefault.id

  const generalFolder = folders.find(
    (folder) => folder.name.trim().toLocaleLowerCase() === DEFAULT_NOTES_FOLDER_NAME.toLocaleLowerCase()
  )
  if (generalFolder) {
    await folderDelegate.update({
      where: { id: generalFolder.id },
      data: { isDefault: true },
    })
    return generalFolder.id
  }

  const created = (await folderDelegate.create({
    data: {
      name: DEFAULT_NOTES_FOLDER_NAME,
      isDefault: true,
    },
    select: { id: true },
  })) as { id: string }
  return created.id
}

async function assertUniqueFolderName(
  folderDelegate: NoteFolderDelegate,
  name: string,
  excludeFolderId?: string
) {
  const normalizedName = name.trim().toLocaleLowerCase()
  const existingFolders = (await folderDelegate.findMany({
    select: { id: true, name: true },
  })) as Array<{ id: string; name: string }>

  const duplicate = existingFolders.find(
    (folder) =>
      folder.id !== excludeFolderId &&
      folder.name.trim().toLocaleLowerCase() === normalizedName
  )
  return !duplicate
}

async function ensureSingleDefaultFolder(
  folderDelegate: NoteFolderDelegate
) {
  const defaultFolderId = await resolveDefaultFolderId(folderDelegate)
  await folderDelegate.updateMany({
    where: {
      isDefault: true,
      id: { not: defaultFolderId },
    },
    data: { isDefault: false },
  })
  return defaultFolderId
}

async function resolveFolderId(
  folderDelegate: NoteFolderDelegate,
  folderId: string | null | undefined
): Promise<{ ok: true; folderId: string | null } | { ok: false; error: string }> {
  if (folderId === undefined) return { ok: true, folderId: null }
  if (folderId === null) return { ok: true, folderId: null }

  const folder = (await folderDelegate.findFirst({
    where: { id: folderId },
    select: { id: true },
  })) as { id: string } | null

  if (!folder) return { ok: false, error: "Folder not found" }
  return { ok: true, folderId: folder.id }
}

export async function listNotes(input?: { query?: string; archived?: boolean; limit?: number }) {
  try {
    await requireAuth()
    const noteDelegate = getNoteDelegate()
    if (!noteDelegate) {
      return {
        success: false,
        error: NOTES_STORAGE_NOT_READY_ERROR,
        data: [] as NoteRecord[],
      }
    }
    const validated = ListNotesSchema.parse(input || {})
    const query = validated.query?.trim() || ""
    const limit = validated.limit ?? 300
    const archived = validated.archived ?? false

    const notes = (await noteDelegate.findMany({
      where: {
        archived,
        deletedAt: null,
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { contentText: { contains: query } },
              ],
            }
          : {}),
      },
      include: {
        tags: {
          include: { tag: true },
        },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: limit,
    })) as NoteEntity[]

    return { success: true, data: notes.map(serializeNote) as NoteRecord[] }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to list notes"), data: [] as NoteRecord[] }
  }
}

export async function createNote(input?: { title?: string; content?: string; pinned?: boolean; archived?: boolean; folderId?: string | null }) {
  try {
    const session = await requireAuth()
    const noteDelegate = getNoteDelegate()
    const folderDelegate = getNoteFolderDelegate()
    if (!noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validated = CreateNoteSchema.parse(input || {})
    const content = validated.content || ""
    const title = deriveNoteTitleFromContent(content, normalizeNoteTitle(validated.title))
    const contentText = toNoteContentText(content)
    const contentFeatures = deriveNoteContentFeatures(content)

    let resolvedFolderId: string | null = null
    let shouldWriteFolderId = false
    if (validated.folderId !== undefined) {
      if (!folderDelegate) {
        return {
          success: false,
          error: "Note folders are not ready yet. Run `npx prisma migrate deploy` and `npx prisma generate`.",
        }
      }
      const folderResolution = await resolveFolderId(folderDelegate, validated.folderId)
      if (!folderResolution.ok) {
        return { success: false, error: folderResolution.error }
      }
      resolvedFolderId = folderResolution.folderId
      shouldWriteFolderId = true
    } else if (folderDelegate) {
      try {
        resolvedFolderId = await ensureSingleDefaultFolder(folderDelegate)
        shouldWriteFolderId = true
      } catch {
        shouldWriteFolderId = false
      }
    }

    const baseData = {
      title,
      content,
      contentText,
      pinned: validated.pinned ?? false,
      archived: validated.archived ?? false,
      deletedAt: null,
      hasChecklist: contentFeatures.hasChecklist,
      hasAttachment: contentFeatures.hasAttachment,
    }

    let note: NoteEntity
    try {
      note = (await noteDelegate.create({
        data: shouldWriteFolderId ? { ...baseData, folderId: resolvedFolderId } : baseData,
      })) as NoteEntity
    } catch (error) {
      if (!shouldWriteFolderId || !isUnknownFolderFieldError(error)) {
        throw error
      }
      note = (await noteDelegate.create({
        data: baseData,
      })) as NoteEntity
    }

    try {
      await syncNoteContentMetadata(note.id, content)
    } catch (error) {
      await prisma.note.delete({ where: { id: note.id } }).catch(() => undefined)
      throw error
    }
    const serializedNote = await findSerializedNote(note.id)
    if (!serializedNote) {
      return { success: false, error: "Failed to load created note" }
    }

    await logSessionAuditEvent(session, {
      action: "NOTE_CREATED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")

    return { success: true, data: serializedNote }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to create note") }
  }
}

export async function updateNote(
  noteId: string,
  input: { title?: string; content?: string; pinned?: boolean; archived?: boolean; folderId?: string | null }
) {
  try {
    const session = await requireAuth()
    const noteDelegate = getNoteDelegate()
    const folderDelegate = getNoteFolderDelegate()
    if (!noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const validated = UpdateNoteSchema.parse(input || {})

    const existing = (await noteDelegate.findFirst({
      where: { id: validatedNoteId },
      select: { id: true, content: true, createdAt: true },
    })) as { id: string; content: string; createdAt: Date } | null
    if (!existing) {
      return { success: false, error: "Note not found" }
    }

    const updateData: {
      title?: string
      content?: string
      contentText?: string
      pinned?: boolean
      archived?: boolean
      folderId?: string | null
      hasChecklist?: boolean
      hasAttachment?: boolean
    } = {}

    if (validated.content !== undefined) {
      // Content, derived metadata and tag assignments are committed together below.
    } else if (validated.title !== undefined) {
      updateData.title = normalizeNoteTitle(validated.title)
    }
    if (validated.pinned !== undefined) updateData.pinned = validated.pinned
    if (validated.archived !== undefined) updateData.archived = validated.archived
    if (validated.folderId !== undefined) {
      if (!folderDelegate) {
        return {
          success: false,
          error: "Note folders are not ready yet. Run `npx prisma migrate deploy` and `npx prisma generate`.",
        }
      }
      const folderResolution = await resolveFolderId(folderDelegate, validated.folderId)
      if (!folderResolution.ok) {
        return { success: false, error: folderResolution.error }
      }
      updateData.folderId = folderResolution.folderId
    }

    if (validated.content !== undefined) {
      await syncNoteContentMetadata(validatedNoteId, validated.content)
    }

    if (Object.keys(updateData).length === 0) {
      const unchangedNote = await findSerializedNote(validatedNoteId)
      if (!unchangedNote) return { success: false, error: "Note not found" }
      await logSessionAuditEvent(session, {
        action: "NOTE_UPDATED",
        details: `noteId=${validatedNoteId}`,
      })
      revalidatePath("/notes")
      return { success: true, data: unchangedNote }
    }

    const note = (await noteDelegate.update({
      where: { id: validatedNoteId },
      data: updateData,
    })) as NoteEntity
    const serializedNote = await findSerializedNote(note.id)
    if (!serializedNote) {
      return { success: false, error: "Failed to load updated note" }
    }

    await logSessionAuditEvent(session, {
      action: "NOTE_UPDATED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")

    return { success: true, data: serializedNote }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to update note") }
  }
}

export async function deleteNote(noteId: string) {
  try {
    const session = await requireAuth()
    const noteDelegate = getNoteDelegate()
    if (!noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const note = (await noteDelegate.findFirst({
      where: { id: validatedNoteId },
      select: { id: true },
    })) as { id: string } | null
    if (!note) {
      return { success: false, error: "Note not found" }
    }

    await noteDelegate.update({
      where: { id: note.id },
      data: { deletedAt: new Date(), pinned: false },
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_MOVED_TO_TRASH",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")

    return { success: true }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to delete note") }
  }
}

export async function restoreNote(noteId: string) {
  try {
    const session = await requireAuth()
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const note = await prisma.note.findUnique({
      where: { id: validatedNoteId },
      select: { id: true, deletedAt: true },
    })
    if (!note) return { success: false, error: "Note not found" }
    if (!note.deletedAt) {
      const unchanged = await findSerializedNote(note.id)
      return unchanged
        ? { success: true, data: unchanged }
        : { success: false, error: "Note not found" }
    }

    await prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: null },
    })
    const restored = await findSerializedNote(note.id)
    await logSessionAuditEvent(session, {
      action: "NOTE_RESTORED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")
    return restored
      ? { success: true, data: restored }
      : { success: false, error: "Failed to load restored note" }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to restore note") }
  }
}

export async function permanentlyDeleteNote(noteId: string) {
  try {
    const session = await requireAuth()
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const note = await prisma.note.findUnique({
      where: { id: validatedNoteId },
      select: { id: true },
    })
    if (!note) return { success: false, error: "Note not found" }

    await prisma.note.delete({ where: { id: note.id } })
    await logSessionAuditEvent(session, {
      action: "NOTE_PERMANENTLY_DELETED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")
    return { success: true }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to permanently delete note") }
  }
}

export async function purgeDeletedNotes(input?: { dryRun?: boolean; now?: string }) {
  try {
    await requireAuth()
    const now = input?.now ? new Date(input.now) : new Date()
    if (Number.isNaN(now.getTime())) {
      return { success: false, error: "Invalid purge date" }
    }
    const summary = await runDeletedNotesRetention({
      dryRun: Boolean(input?.dryRun),
      now,
    })
    if (!input?.dryRun && summary.deletedCount) revalidatePath("/notes")
    return {
      success: true,
      data: summary,
    }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to purge deleted notes") }
  }
}

export async function setNoteArchived(noteId: string, archived: boolean) {
  return updateNote(noteId, { archived })
}

export async function setNotePinned(noteId: string, pinned: boolean) {
  return updateNote(noteId, { pinned })
}

export async function listNoteFolders() {
  try {
    await requireAuth()
    const folderDelegate = getNoteFolderDelegate()
    if (!folderDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR, data: [] as NoteFolderRecord[] }
    }

    await ensureSingleDefaultFolder(folderDelegate)

    const folders = (await folderDelegate.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    })) as NoteFolderEntity[]

    return { success: true, data: folders.map(serializeFolder) as NoteFolderRecord[] }
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to list note folders"),
      data: [] as NoteFolderRecord[],
    }
  }
}

export async function createNoteFolder(input: { name: string; parentId?: string | null }) {
  try {
    const session = await requireAuth()
    const folderDelegate = getNoteFolderDelegate()
    if (!folderDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validated = CreateFolderSchema.parse(input)
    const normalizedName = validated.name.trim()
    await ensureSingleDefaultFolder(folderDelegate)

    const uniqueName = await assertUniqueFolderName(folderDelegate, normalizedName)
    if (!uniqueName) {
      return { success: false, error: "Folder name already exists" }
    }

    let parentId: string | null = null
    if (validated.parentId) {
      const parent = await prisma.noteFolder.findUnique({
        where: { id: validated.parentId },
        select: { id: true, parentId: true },
      })
      if (!parent) return { success: false, error: "Parent folder not found" }
      if (parent.parentId) {
        return { success: false, error: "Folders support one nested level" }
      }
      parentId = parent.id
    }

    const highestSibling = await prisma.noteFolder.findFirst({
      where: { parentId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })
    const folder = (await folderDelegate.create({
      data: {
        name: normalizedName,
        isDefault: false,
        parentId,
        sortOrder: (highestSibling?.sortOrder ?? 0) + 1000,
      },
    })) as NoteFolderEntity

    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_CREATED",
      details: `folderId=${folder.id}`,
    })
    revalidatePath("/notes")

    return { success: true, data: serializeFolder(folder) as NoteFolderRecord }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to create folder") }
  }
}

export async function renameNoteFolder(folderId: string, input: { name: string }) {
  try {
    const session = await requireAuth()
    const folderDelegate = getNoteFolderDelegate()
    if (!folderDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validatedFolderId = NoteIdSchema.parse(folderId)
    const validated = RenameFolderSchema.parse(input)
    const normalizedName = validated.name.trim()

    const folder = (await folderDelegate.findFirst({
      where: { id: validatedFolderId },
    })) as NoteFolderEntity | null
    if (!folder) {
      return { success: false, error: "Folder not found" }
    }

    const uniqueName = await assertUniqueFolderName(
      folderDelegate,
      normalizedName,
      validatedFolderId
    )
    if (!uniqueName) {
      return { success: false, error: "Folder name already exists" }
    }

    const updated = (await folderDelegate.update({
      where: { id: validatedFolderId },
      data: { name: normalizedName },
    })) as NoteFolderEntity

    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_RENAMED",
      details: `folderId=${updated.id}`,
    })
    revalidatePath("/notes")

    return { success: true, data: serializeFolder(updated) as NoteFolderRecord }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to rename folder") }
  }
}

export async function moveNoteFolder(
  folderId: string,
  input: { parentId: string | null; sortOrder: number }
) {
  try {
    const session = await requireAuth()
    const validatedFolderId = NoteIdSchema.parse(folderId)
    const validated = MoveFolderSchema.parse(input)
    const folder = await prisma.noteFolder.findUnique({
      where: { id: validatedFolderId },
      include: { children: { select: { id: true } } },
    })
    if (!folder) return { success: false, error: "Folder not found" }
    if (folder.isDefault && validated.parentId) {
      return { success: false, error: "The default folder must stay at the top level" }
    }
    if (validated.parentId === folder.id) {
      return { success: false, error: "A folder cannot contain itself" }
    }
    if (validated.parentId) {
      const parent = await prisma.noteFolder.findUnique({
        where: { id: validated.parentId },
        select: { id: true, parentId: true },
      })
      if (!parent) return { success: false, error: "Parent folder not found" }
      if (parent.parentId) {
        return { success: false, error: "Folders support one nested level" }
      }
      if (folder.children.length) {
        return { success: false, error: "A folder with subfolders must stay at the top level" }
      }
    }

    const updated = await prisma.noteFolder.update({
      where: { id: folder.id },
      data: {
        parentId: validated.parentId,
        sortOrder: validated.sortOrder,
      },
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_MOVED",
      details: `folderId=${updated.id};parentId=${updated.parentId || "root"}`,
    })
    revalidatePath("/notes")
    return { success: true, data: serializeFolder(updated) }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to move folder") }
  }
}

export async function deleteNoteFolder(folderId: string) {
  try {
    const session = await requireAuth()
    const folderDelegate = getNoteFolderDelegate()
    const noteDelegate = getNoteDelegate()
    if (!folderDelegate || !noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validatedFolderId = NoteIdSchema.parse(folderId)

    const folder = (await folderDelegate.findFirst({
      where: { id: validatedFolderId },
    })) as NoteFolderEntity | null
    if (!folder) {
      return { success: false, error: "Folder not found" }
    }
    if (folder.isDefault) {
      return { success: false, error: "Default folder cannot be deleted" }
    }

    const defaultFolderId = await ensureSingleDefaultFolder(folderDelegate)
    const defaultFolder = (await folderDelegate.findFirst({
      where: { id: defaultFolderId },
    })) as NoteFolderEntity | null
    if (!defaultFolder) {
      return { success: false, error: "Default folder not found" }
    }

    await (prisma as unknown as {
      $transaction: (fn: (tx: { note: NoteDelegate; noteFolder: NoteFolderDelegate }) => Promise<void>) => Promise<void>
    }).$transaction(async (tx) => {
      await tx.noteFolder.updateMany({
        where: {
          parentId: validatedFolderId,
        },
        data: {
          parentId: null,
        },
      })

      await tx.note.updateMany({
        where: {
          folderId: validatedFolderId,
        },
        data: {
          folderId: defaultFolderId,
        },
      })

      await tx.noteFolder.delete({
        where: {
          id: validatedFolderId,
        },
      })
    })

    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_DELETED",
      details: `folderId=${validatedFolderId};movedTo=${defaultFolderId}`,
    })
    revalidatePath("/notes")

    return {
      success: true,
      data: {
        deletedFolderId: validatedFolderId,
        defaultFolderId,
        defaultFolderName: defaultFolder.name,
      },
    }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to delete folder") }
  }
}

export async function listNoteTags() {
  try {
    await requireAuth()
    const tags = await prisma.noteTag.findMany({
      orderBy: { normalizedName: "asc" },
      include: {
        _count: {
          select: {
            notes: {
              where: {
                note: { deletedAt: null, archived: false },
              },
            },
          },
        },
      },
    })
    return {
      success: true,
      data: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        normalizedName: tag.normalizedName,
        count: tag._count.notes,
      })) satisfies NoteTagRecord[],
    }
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to list note tags"),
      data: [] as NoteTagRecord[],
    }
  }
}

export async function listNoteSmartFolders() {
  try {
    await requireAuth()
    const smartFolders = await prisma.noteSmartFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        tags: {
          include: { tag: true },
        },
      },
    })
    return {
      success: true,
      data: smartFolders.map(serializeSmartFolder),
    }
  } catch (error) {
    return {
      success: false,
      error: getActionErrorMessage(error, "Failed to list smart folders"),
      data: [] as NoteSmartFolderRecord[],
    }
  }
}

export async function createNoteSmartFolder(input: {
  name: string
  matchMode?: NoteSmartFolderMatchMode
  tagIds?: string[]
  requirePinned?: boolean | null
  requireChecklist?: boolean | null
  requireAttachment?: boolean | null
  updatedWithinDays?: number | null
}) {
  try {
    const session = await requireAuth()
    const validated = SmartFolderInputSchema.parse(input)
    const normalizedName = validated.name.trim().toLocaleLowerCase()
    const duplicate = await prisma.noteSmartFolder.findMany({
      select: { name: true },
    })
    if (duplicate.some((folder) => folder.name.trim().toLocaleLowerCase() === normalizedName)) {
      return { success: false, error: "Smart folder name already exists" }
    }

    const uniqueTagIds = [...new Set(validated.tagIds)]
    if (uniqueTagIds.length) {
      const existingTagCount = await prisma.noteTag.count({
        where: { id: { in: uniqueTagIds } },
      })
      if (existingTagCount !== uniqueTagIds.length) {
        return { success: false, error: "One or more tags no longer exist" }
      }
    }
    const highest = await prisma.noteSmartFolder.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })
    const smartFolder = await prisma.noteSmartFolder.create({
      data: {
        name: validated.name.trim(),
        matchMode: validated.matchMode,
        requirePinned: validated.requirePinned,
        requireChecklist: validated.requireChecklist,
        requireAttachment: validated.requireAttachment,
        updatedWithinDays: validated.updatedWithinDays,
        sortOrder: (highest?.sortOrder ?? 0) + 1000,
        tags: {
          create: uniqueTagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
      include: {
        tags: { include: { tag: true } },
      },
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_SMART_FOLDER_CREATED",
      details: `smartFolderId=${smartFolder.id}`,
    })
    revalidatePath("/notes")
    return { success: true, data: serializeSmartFolder(smartFolder) }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to create smart folder") }
  }
}

export async function updateNoteSmartFolder(
  smartFolderId: string,
  input: {
    name: string
    matchMode?: NoteSmartFolderMatchMode
    tagIds?: string[]
    requirePinned?: boolean | null
    requireChecklist?: boolean | null
    requireAttachment?: boolean | null
    updatedWithinDays?: number | null
  }
) {
  try {
    const session = await requireAuth()
    const validatedId = NoteIdSchema.parse(smartFolderId)
    const validated = SmartFolderInputSchema.parse(input)
    const existing = await prisma.noteSmartFolder.findUnique({
      where: { id: validatedId },
      select: { id: true },
    })
    if (!existing) return { success: false, error: "Smart folder not found" }

    const duplicate = await prisma.noteSmartFolder.findMany({
      where: { id: { not: validatedId } },
      select: { name: true },
    })
    const normalizedName = validated.name.trim().toLocaleLowerCase()
    if (duplicate.some((folder) => folder.name.trim().toLocaleLowerCase() === normalizedName)) {
      return { success: false, error: "Smart folder name already exists" }
    }

    const uniqueTagIds = [...new Set(validated.tagIds)]
    if (uniqueTagIds.length) {
      const existingTagCount = await prisma.noteTag.count({
        where: { id: { in: uniqueTagIds } },
      })
      if (existingTagCount !== uniqueTagIds.length) {
        return { success: false, error: "One or more tags no longer exist" }
      }
    }

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.noteSmartFolderTag.deleteMany({
        where: { smartFolderId: validatedId },
      })
      await transaction.noteSmartFolder.update({
        where: { id: validatedId },
        data: {
          name: validated.name.trim(),
          matchMode: validated.matchMode,
          requirePinned: validated.requirePinned,
          requireChecklist: validated.requireChecklist,
          requireAttachment: validated.requireAttachment,
          updatedWithinDays: validated.updatedWithinDays,
        },
      })
      if (uniqueTagIds.length) {
        await transaction.noteSmartFolderTag.createMany({
          data: uniqueTagIds.map((tagId) => ({ smartFolderId: validatedId, tagId })),
        })
      }
      return transaction.noteSmartFolder.findUnique({
        where: { id: validatedId },
        include: { tags: { include: { tag: true } } },
      })
    })
    if (!updated) return { success: false, error: "Smart folder not found" }
    await logSessionAuditEvent(session, {
      action: "NOTE_SMART_FOLDER_UPDATED",
      details: `smartFolderId=${updated.id}`,
    })
    revalidatePath("/notes")
    return { success: true, data: serializeSmartFolder(updated) }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to update smart folder") }
  }
}

export async function deleteNoteSmartFolder(smartFolderId: string) {
  try {
    const session = await requireAuth()
    const validatedId = NoteIdSchema.parse(smartFolderId)
    const existing = await prisma.noteSmartFolder.findUnique({
      where: { id: validatedId },
      select: { id: true },
    })
    if (!existing) return { success: false, error: "Smart folder not found" }
    await prisma.noteSmartFolder.delete({ where: { id: validatedId } })
    await logSessionAuditEvent(session, {
      action: "NOTE_SMART_FOLDER_DELETED",
      details: `smartFolderId=${validatedId}`,
    })
    revalidatePath("/notes")
    return { success: true }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to delete smart folder") }
  }
}
