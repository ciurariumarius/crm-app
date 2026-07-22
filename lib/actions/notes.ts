"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { z } from "zod"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { DEFAULT_NOTE_TITLE, deriveNoteTitleFromContent } from "@/lib/notes/derived-note-text"

export type NoteRecord = {
  id: string
  folderId?: string | null
  folderName?: string | null
  title: string
  content: string
  contentText: string
  archived: boolean
  pinned: boolean
  createdAt: string
  updatedAt: string
  sourceType?: "note" | "project" | "task"
  sourceId?: string
  sourceProjectId?: string
  sourceLabel?: string
}

export type NoteFolderRecord = {
  id: string
  name: string
  isDefault: boolean
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
  name: string
  isDefault: boolean
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
})

const RenameFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

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
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

function serializeFolder(folder: NoteFolderEntity): NoteFolderRecord {
  return {
    id: folder.id,
    name: folder.name,
    isDefault: folder.isDefault,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  }
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
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { contentText: { contains: query } },
              ],
            }
          : {}),
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

    await logSessionAuditEvent(session, {
      action: "NOTE_CREATED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")

    return { success: true, data: serializeNote(note) as NoteRecord }
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
    } = {}

    if (validated.content !== undefined) {
      updateData.content = validated.content
      updateData.contentText = toNoteContentText(validated.content)
      updateData.title = deriveNoteTitleFromContent(validated.content, normalizeNoteTitle(validated.title))
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

    if (Object.keys(updateData).length === 0) {
      const unchangedNote = (await noteDelegate.findFirst({
        where: { id: validatedNoteId },
      })) as NoteEntity | null
      if (!unchangedNote) return { success: false, error: "Note not found" }
      return { success: true, data: serializeNote(unchangedNote) as NoteRecord }
    }

    const note = (await noteDelegate.update({
      where: { id: validatedNoteId },
      data: updateData,
    })) as NoteEntity

    await logSessionAuditEvent(session, {
      action: "NOTE_UPDATED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")

    return { success: true, data: serializeNote(note) as NoteRecord }
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

    await noteDelegate.delete({ where: { id: note.id } })
    await logSessionAuditEvent(session, {
      action: "NOTE_DELETED",
      details: `noteId=${note.id}`,
    })
    revalidatePath("/notes")

    return { success: true }
  } catch (error) {
    return { success: false, error: getActionErrorMessage(error, "Failed to delete note") }
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
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
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

export async function createNoteFolder(input: { name: string }) {
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

    const folder = (await folderDelegate.create({
      data: {
        name: normalizedName,
        isDefault: false,
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
