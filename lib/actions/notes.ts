"use server"

import { z } from "zod"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { DEFAULT_NOTE_TITLE, deriveNoteTitleFromContent } from "@/lib/notes/derived-note-text"
import {
  getNotesWorkspaceBootstrap,
  getPersonalNoteDetail,
  queryPersonalNoteList,
  type NoteDetail,
  type NoteFolderRecord,
  type NoteListQueryInput,
  type NoteListRow,
  type NotesView,
} from "@/lib/notes/queries.server"
import {
  removeFolderMentions,
  replaceFolderMentionLabel,
} from "@/lib/notes/folder-mentions"

export type {
  NoteDetail,
  NoteFolderRecord,
  NoteListQueryInput,
  NoteListRow,
  NotesView,
}

const NoteIdSchema = z.string().uuid("Invalid note")
const FolderIdSchema = z.string().uuid("Invalid folder")
const FolderIdInputSchema = FolderIdSchema.nullable()
const ContentSchema = z.string().max(500_000, "Note is too large")
const CreateFolderSchema = z.object({ name: z.string().trim().min(1).max(80) })
const RenameFolderSchema = z.object({ name: z.string().trim().min(1).max(80) })

const NOTE_CONTENT_CONFLICT = "NOTE_CONTENT_CONFLICT"

function toContentText(content: string) {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|div|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function deriveContentData(content: string) {
  const contentWithoutFolderMentions = removeFolderMentions(content)
  return {
    content,
    contentText: toContentText(contentWithoutFolderMentions),
    title: deriveNoteTitleFromContent(contentWithoutFolderMentions, DEFAULT_NOTE_TITLE),
    hasChecklist:
      /data-type=["']taskList["']/i.test(content) ||
      /data-checked=["'](?:true|false)["']/i.test(content),
    hasAttachment: /<img\b/i.test(content),
  }
}

async function resolveFolder(folderId: string | null | undefined) {
  if (folderId == null) return null
  const folder = await prisma.noteFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  })
  return folder?.id ?? undefined
}

export async function queryNoteList(input: NoteListQueryInput = {}) {
  try {
    await requireAuth()
    return { success: true as const, data: await queryPersonalNoteList(input) }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to load notes"),
    }
  }
}

export async function getNoteDetail(noteId: string) {
  try {
    await requireAuth()
    const id = NoteIdSchema.parse(noteId)
    const note = await getPersonalNoteDetail(id)
    return note
      ? { success: true as const, data: note }
      : { success: false as const, error: "Note not found" }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to load note"),
    }
  }
}

export async function getNotesWorkspaceBootstrapAction(input: {
  view?: NotesView
  selectedNoteId?: string | null
  skipSelectedNote?: boolean
} = {}) {
  try {
    await requireAuth()
    return { success: true as const, data: await getNotesWorkspaceBootstrap(input) }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to load Notes workspace"),
    }
  }
}

export async function createNote(input: {
  id: string
  content: string
  folderId?: string | null
}) {
  try {
    const session = await requireAuth()
    const id = NoteIdSchema.parse(input.id)
    const content = ContentSchema.parse(input.content)
    const folderId = FolderIdInputSchema.optional().parse(input.folderId)
    const resolvedFolderId = await resolveFolder(folderId)
    if (folderId && !resolvedFolderId) return { success: false as const, error: "Folder not found" }

    const existing = await getPersonalNoteDetail(id)
    if (existing) return { success: true as const, data: existing }

    const note = await prisma.note.create({
      data: {
        id,
        folderId: resolvedFolderId ?? null,
        ...deriveContentData(content),
      },
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_CREATED",
      details: `noteId=${note.id}`,
    })
    const detail = await getPersonalNoteDetail(note.id)
    return detail
      ? { success: true as const, data: detail }
      : { success: false as const, error: "Failed to load note" }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to create note"),
    }
  }
}

export async function saveNoteContent(input: {
  noteId: string
  content: string
  expectedRevision: number
  folderId?: string | null
}) {
  try {
    await requireAuth()
    const noteId = NoteIdSchema.parse(input.noteId)
    const content = ContentSchema.parse(input.content)
    const expectedRevision = z.number().int().min(0).parse(input.expectedRevision)
    const folderWasProvided = Object.prototype.hasOwnProperty.call(input, "folderId")
    const folderId = folderWasProvided
      ? FolderIdInputSchema.parse(input.folderId)
      : undefined
    const resolvedFolderId = folderWasProvided ? await resolveFolder(folderId) : undefined
    if (folderId && !resolvedFolderId) return { success: false as const, error: "Folder not found" }

    const updated = await prisma.note.updateMany({
      where: { id: noteId, contentRevision: expectedRevision },
      data: {
        ...deriveContentData(content),
        ...(folderWasProvided ? { folderId: resolvedFolderId ?? null } : {}),
        contentRevision: { increment: 1 },
      },
    })
    if (updated.count !== 1) {
      return {
        success: false as const,
        code: NOTE_CONTENT_CONFLICT,
        error: "This note changed in another view. Your draft is still available.",
      }
    }
    const detail = await getPersonalNoteDetail(noteId)
    return detail
      ? { success: true as const, data: detail }
      : { success: false as const, error: "Note not found" }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to save note"),
    }
  }
}

export async function permanentlyDeleteNote(noteId: string) {
  try {
    const session = await requireAuth()
    const id = NoteIdSchema.parse(noteId)
    const deleted = await prisma.note.deleteMany({ where: { id } })
    if (!deleted.count) return { success: false as const, error: "Note not found" }
    await logSessionAuditEvent(session, {
      action: "NOTE_PERMANENTLY_DELETED",
      details: `noteId=${id}`,
    })
    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to delete note"),
    }
  }
}

export async function createNoteFolder(input: { name: string }) {
  try {
    const session = await requireAuth()
    const { name } = CreateFolderSchema.parse(input)
    const duplicate = await prisma.noteFolder.findFirst({
      where: { name: { equals: name } },
      select: { id: true },
    })
    if (duplicate) return { success: false as const, error: "Folder name already exists" }
    const highest = await prisma.noteFolder.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })
    const folder = await prisma.noteFolder.create({
      data: { name, parentId: null, sortOrder: (highest?.sortOrder ?? 0) + 1000 },
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_CREATED",
      details: `folderId=${folder.id}`,
    })
    return {
      success: true as const,
      data: {
        id: folder.id,
        name: folder.name,
        sortOrder: folder.sortOrder,
        count: 0,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString(),
      } satisfies NoteFolderRecord,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to create folder"),
    }
  }
}

export async function renameNoteFolder(folderId: string, input: { name: string }) {
  try {
    const session = await requireAuth()
    const id = FolderIdSchema.parse(folderId)
    const { name } = RenameFolderSchema.parse(input)
    const folder = await prisma.noteFolder.findUnique({ where: { id } })
    if (!folder) return { success: false as const, error: "Folder not found" }
    const duplicate = await prisma.noteFolder.findFirst({
      where: { name: { equals: name }, NOT: { id } },
      select: { id: true },
    })
    if (duplicate) return { success: false as const, error: "Folder name already exists" }

    const affectedNotes = await prisma.note.findMany({
      where: { folderId: id, content: { contains: `data-note-folder-id=\"${id}\"` } },
      select: { id: true, content: true },
    })
    const updated = await prisma.$transaction(async (transaction) => {
      const nextFolder = await transaction.noteFolder.update({
        where: { id },
        data: { name },
      })
      for (const note of affectedNotes) {
        const content = replaceFolderMentionLabel(note.content, { id, name })
        await transaction.note.update({
          where: { id: note.id },
          data: { ...deriveContentData(content), contentRevision: { increment: 1 } },
        })
      }
      return nextFolder
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_RENAMED",
      details: `folderId=${id}`,
    })
    return {
      success: true as const,
      data: {
        id: updated.id,
        name: updated.name,
        sortOrder: updated.sortOrder,
        count: await prisma.note.count({ where: { folderId: id } }),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      } satisfies NoteFolderRecord,
    }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to rename folder"),
    }
  }
}

export async function deleteNoteFolder(folderId: string) {
  try {
    const session = await requireAuth()
    const id = FolderIdSchema.parse(folderId)
    const folder = await prisma.noteFolder.findUnique({ where: { id }, select: { id: true } })
    if (!folder) return { success: false as const, error: "Folder not found" }
    const notes = await prisma.note.findMany({
      where: { folderId: id },
      select: { id: true, content: true },
    })
    await prisma.$transaction(async (transaction) => {
      for (const note of notes) {
        const content = removeFolderMentions(note.content, id)
        await transaction.note.update({
          where: { id: note.id },
          data: {
            folderId: null,
            ...deriveContentData(content),
            contentRevision: { increment: 1 },
          },
        })
      }
      await transaction.noteFolder.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      })
      await transaction.noteFolder.delete({ where: { id } })
    })
    await logSessionAuditEvent(session, {
      action: "NOTE_FOLDER_DELETED",
      details: `folderId=${id}; movedTo=all`,
    })
    return { success: true as const, data: { deletedFolderId: id } }
  } catch (error) {
    return {
      success: false as const,
      error: getActionErrorMessage(error, "Failed to delete folder"),
    }
  }
}
