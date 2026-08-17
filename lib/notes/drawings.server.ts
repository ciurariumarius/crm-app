import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { z } from "zod"
import prisma from "@/lib/prisma"
import {
  buildProjectNoteRelativePath,
  createSignedProjectNoteUrl,
  resolveProjectNoteAbsolutePath,
} from "@/lib/project-note-storage"
import {
  NOTE_DRAWING_VERSION,
  type NoteDrawingDocument,
  type NoteDrawingOwner,
  type NoteDrawingRecord,
} from "@/lib/notes/drawings"

export const MAX_DRAWING_STROKE_BYTES = 2 * 1024 * 1024
export const MAX_DRAWING_PREVIEW_BYTES = 4 * 1024 * 1024
const MIN_CANVAS_SIZE = 160
const MAX_CANVAS_SIZE = 4096

export class DrawingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DrawingValidationError"
  }
}

const DrawingOwnerSchema = z.object({
  type: z.enum(["note", "project", "task"]),
  id: z.string().uuid("Invalid drawing owner"),
})

const DrawingPointSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1),
])

const DrawingStrokeSchema = z.object({
  id: z.string().trim().min(1).max(120),
  tool: z.enum(["pen", "highlighter"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Invalid drawing color"),
  size: z.number().min(1).max(80),
  points: z.array(DrawingPointSchema).min(1).max(30_000),
})

const DrawingDocumentSchema = z.object({
  version: z.literal(NOTE_DRAWING_VERSION),
  strokes: z.array(DrawingStrokeSchema).max(2_000),
})

const DrawingDimensionsSchema = z.object({
  width: z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE),
  height: z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE),
})

export type ParsedDrawingPayload = {
  owner: NoteDrawingOwner
  document: NoteDrawingDocument
  strokeData: string
  width: number
  height: number
  preview: File
  expectedUpdatedAt: Date | null
}

function parseJsonField<T>(value: FormDataEntryValue | null, label: string): T {
  if (typeof value !== "string" || !value.trim()) {
    throw new DrawingValidationError(`${label} is required`)
  }
  try {
    return JSON.parse(value) as T
  } catch {
    throw new DrawingValidationError(`${label} is invalid`)
  }
}

export function parseDrawingPayload(formData: FormData): ParsedDrawingPayload {
  const owner = DrawingOwnerSchema.parse(
    parseJsonField<unknown>(formData.get("owner"), "Drawing owner")
  )
  const strokeDataEntry = formData.get("strokeData")
  if (typeof strokeDataEntry !== "string") throw new DrawingValidationError("Drawing data is required")
  if (Buffer.byteLength(strokeDataEntry, "utf8") > MAX_DRAWING_STROKE_BYTES) {
    throw new DrawingValidationError("Drawing is too large")
  }
  const document = DrawingDocumentSchema.parse(parseJsonField<unknown>(strokeDataEntry, "Drawing data"))
  const dimensions = DrawingDimensionsSchema.parse({
    width: Number(formData.get("canvasWidth")),
    height: Number(formData.get("canvasHeight")),
  })
  const preview = formData.get("preview")
  if (!(preview instanceof File)) throw new DrawingValidationError("Drawing preview is required")
  if (preview.size <= 0 || preview.size > MAX_DRAWING_PREVIEW_BYTES) {
    throw new DrawingValidationError("Drawing preview must be between 1 byte and 4MB")
  }

  const expectedUpdatedAtRaw = formData.get("expectedUpdatedAt")
  let expectedUpdatedAt: Date | null = null
  if (typeof expectedUpdatedAtRaw === "string" && expectedUpdatedAtRaw.trim()) {
    expectedUpdatedAt = new Date(expectedUpdatedAtRaw)
    if (Number.isNaN(expectedUpdatedAt.getTime())) throw new DrawingValidationError("Invalid drawing revision")
  }

  return {
    owner,
    document,
    strokeData: JSON.stringify(document),
    width: dimensions.width,
    height: dimensions.height,
    preview,
    expectedUpdatedAt,
  }
}

export async function assertDrawingOwnerExists(owner: NoteDrawingOwner) {
  const record = owner.type === "note"
    ? await prisma.note.findUnique({ where: { id: owner.id }, select: { id: true } })
    : owner.type === "project"
      ? await prisma.project.findUnique({ where: { id: owner.id }, select: { id: true } })
      : await prisma.task.findUnique({ where: { id: owner.id }, select: { id: true } })
  if (!record) throw new DrawingValidationError("Drawing owner was not found")
}

export function ownerCreateData(owner: NoteDrawingOwner) {
  if (owner.type === "note") return { noteId: owner.id, projectId: null, taskId: null }
  if (owner.type === "project") return { noteId: null, projectId: owner.id, taskId: null }
  return { noteId: null, projectId: null, taskId: owner.id }
}

export function ownerFromDrawing(drawing: {
  noteId: string | null
  projectId: string | null
  taskId: string | null
}): NoteDrawingOwner {
  if (drawing.noteId) return { type: "note", id: drawing.noteId }
  if (drawing.projectId) return { type: "project", id: drawing.projectId }
  if (drawing.taskId) return { type: "task", id: drawing.taskId }
  throw new Error("Drawing has no owner")
}

export function drawingOwnerMatches(
  drawing: { noteId: string | null; projectId: string | null; taskId: string | null },
  owner: NoteDrawingOwner
) {
  const current = ownerFromDrawing(drawing)
  return current.type === owner.type && current.id === owner.id
}

export async function writeDrawingPreview(
  file: File,
  drawingId: string,
  expectedDimensions: { width: number; height: number }
) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  if (!isPng) throw new DrawingValidationError("Drawing preview must be a PNG image")

  const metadata = await sharp(buffer).metadata()
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_CANVAS_SIZE ||
    metadata.height > MAX_CANVAS_SIZE ||
    metadata.width !== expectedDimensions.width ||
    metadata.height !== expectedDimensions.height
  ) {
    throw new DrawingValidationError("Drawing preview dimensions are invalid")
  }

  const relativePath = buildProjectNoteRelativePath(
    "drawings",
    `${drawingId}-${randomUUID()}.png`
  )
  const absolutePath = resolveProjectNoteAbsolutePath(relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer, { flag: "wx" })
  return relativePath
}

export async function removeDrawingPreview(relativePath: string | null | undefined) {
  if (!relativePath) return
  await unlink(resolveProjectNoteAbsolutePath(relativePath)).catch(() => undefined)
}

export function serializeDrawing(drawing: {
  id: string
  noteId: string | null
  projectId: string | null
  taskId: string | null
  strokeData: string
  previewPath: string
  canvasWidth: number
  canvasHeight: number
  createdAt: Date
  updatedAt: Date
}): NoteDrawingRecord {
  return {
    id: drawing.id,
    owner: ownerFromDrawing(drawing),
    document: DrawingDocumentSchema.parse(JSON.parse(drawing.strokeData)),
    canvasWidth: drawing.canvasWidth,
    canvasHeight: drawing.canvasHeight,
    previewUrl: createSignedProjectNoteUrl(drawing.previewPath),
    createdAt: drawing.createdAt.toISOString(),
    updatedAt: drawing.updatedAt.toISOString(),
  }
}

export function extractDrawingIds(content: string) {
  const ids = new Set<string>()
  for (const match of content.matchAll(/data-note-drawing-id=["']([0-9a-f-]{36})["']/gi)) {
    if (match[1]) ids.add(match[1].toLowerCase())
  }
  return ids
}
