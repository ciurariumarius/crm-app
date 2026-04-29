"use server"

import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { z } from "zod"
import { getActionErrorMessage } from "@/lib/action-errors"
import { logSessionAuditEvent } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export type NoteRecord = {
  id: string
  tenantId: string
  userId: string
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

type NoteEntity = {
  id: string
  tenantId: string
  userId: string
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
  delete: (args: unknown) => Promise<unknown>
}

function getNoteDelegate() {
  const delegate = (prisma as unknown as { note?: NoteDelegate }).note

  if (!delegate || typeof delegate.findMany !== "function") return null
  return delegate
}

const NOTES_STORAGE_NOT_READY_ERROR =
  "Notes storage is not ready yet. Run `npx prisma generate` + `npx prisma migrate deploy`, then restart the app."

const NoteIdSchema = z.string().trim().min(1, "Invalid note id")

const CreateNoteSchema = z.object({
  title: z.string().trim().max(240).optional(),
  content: z.string().max(200000).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
})

const UpdateNoteSchema = z.object({
  title: z.string().trim().max(240).optional(),
  content: z.string().max(200000).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
})

const ListNotesSchema = z.object({
  query: z.string().trim().max(200).optional(),
  archived: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

const DEFAULT_NOTE_TITLE = "New note"

function getDefaultNoteTitle() {
  return DEFAULT_NOTE_TITLE
}

function normalizeNoteTitle(value: string | null | undefined) {
  const title = (value || "").trim()
  if (!title) return getDefaultNoteTitle()
  if (title.toLowerCase() === "untitled" || title.toLowerCase() === "untitled note") {
    return getDefaultNoteTitle()
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
    tenantId: note.tenantId,
    userId: note.userId,
    title: note.title,
    content: note.content,
    contentText: note.contentText,
    archived: note.archived,
    pinned: note.pinned,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

export async function listNotes(input?: { query?: string; archived?: boolean; limit?: number }) {
  try {
    const session = await requireTenantContext()
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
        tenantId: session.tenantId,
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

export async function createNote(input?: { title?: string; content?: string; pinned?: boolean; archived?: boolean }) {
  try {
    const session = await requireTenantContext()
    const noteDelegate = getNoteDelegate()
    if (!noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validated = CreateNoteSchema.parse(input || {})
    const title = normalizeNoteTitle(validated.title)
    const content = validated.content || ""
    const contentText = toNoteContentText(content)

    const note = (await noteDelegate.create({
      data: {
        tenantId: session.tenantId,
        userId: session.userId,
        title,
        content,
        contentText,
        pinned: validated.pinned ?? false,
        archived: validated.archived ?? false,
      },
    })) as NoteEntity

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
  input: { title?: string; content?: string; pinned?: boolean; archived?: boolean }
) {
  try {
    const session = await requireTenantContext()
    const noteDelegate = getNoteDelegate()
    if (!noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const validated = UpdateNoteSchema.parse(input || {})

    const existing = (await noteDelegate.findFirst({
      where: { id: validatedNoteId, tenantId: session.tenantId },
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
    } = {}

    if (validated.title !== undefined) updateData.title = normalizeNoteTitle(validated.title)
    if (validated.content !== undefined) {
      updateData.content = validated.content
      updateData.contentText = toNoteContentText(validated.content)
    }
    if (validated.pinned !== undefined) updateData.pinned = validated.pinned
    if (validated.archived !== undefined) updateData.archived = validated.archived

    if (Object.keys(updateData).length === 0) {
      const unchangedNote = (await noteDelegate.findFirst({
        where: { id: validatedNoteId, tenantId: session.tenantId },
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
    const session = await requireTenantContext()
    const noteDelegate = getNoteDelegate()
    if (!noteDelegate) {
      return { success: false, error: NOTES_STORAGE_NOT_READY_ERROR }
    }
    const validatedNoteId = NoteIdSchema.parse(noteId)
    const note = (await noteDelegate.findFirst({
      where: { id: validatedNoteId, tenantId: session.tenantId },
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
