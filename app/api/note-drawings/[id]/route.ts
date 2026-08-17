import { ZodError, z } from "zod"
import { requireAuth } from "@/lib/auth"
import { apiError, apiRouteError } from "@/lib/api-response"
import prisma from "@/lib/prisma"
import {
  DrawingValidationError,
  drawingOwnerMatches,
  parseDrawingPayload,
  removeDrawingPreview,
  serializeDrawing,
  writeDrawingPreview,
} from "@/lib/notes/drawings.server"

export const runtime = "nodejs"

const DrawingIdSchema = z.string().uuid("Invalid drawing id")

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_: Request, context: RouteContext) {
  try {
    await requireAuth()
    const { id: rawId } = await context.params
    const id = DrawingIdSchema.parse(rawId)
    const drawing = await prisma.noteDrawing.findUnique({ where: { id } })
    if (!drawing) return apiError("Drawing not found", 404, { code: "DRAWING_NOT_FOUND" })
    return Response.json({ success: true, data: serializeDrawing(drawing) })
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message || "Invalid drawing", 400, { code: "INVALID_DRAWING" })
    }
    return apiRouteError(error, {
      fallbackMessage: "Failed to load drawing",
      fallbackCode: "DRAWING_LOAD_FAILED",
      logLabel: "[note-drawings/get] failed",
    })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let nextPreviewPath: string | null = null
  try {
    await requireAuth()
    const { id: rawId } = await context.params
    const id = DrawingIdSchema.parse(rawId)
    const payload = parseDrawingPayload(await request.formData())
    if (!payload.expectedUpdatedAt) {
      return apiError("Drawing revision is required", 400, { code: "INVALID_DRAWING_REVISION" })
    }

    const existing = await prisma.noteDrawing.findUnique({ where: { id } })
    if (!existing) return apiError("Drawing not found", 404, { code: "DRAWING_NOT_FOUND" })
    if (!drawingOwnerMatches(existing, payload.owner)) {
      return apiError("Drawing owner cannot be changed", 400, { code: "DRAWING_OWNER_MISMATCH" })
    }

    nextPreviewPath = await writeDrawingPreview(payload.preview, id, {
      width: payload.width,
      height: payload.height,
    })
    const updated = await prisma.noteDrawing.updateMany({
      where: { id, updatedAt: payload.expectedUpdatedAt },
      data: {
        strokeData: payload.strokeData,
        previewPath: nextPreviewPath,
        canvasWidth: payload.width,
        canvasHeight: payload.height,
      },
    })
    if (updated.count !== 1) {
      await removeDrawingPreview(nextPreviewPath)
      nextPreviewPath = null
      return apiError(
        "This drawing changed before your edit could save. Your local strokes were kept.",
        409,
        { code: "DRAWING_CONFLICT" }
      )
    }

    const drawing = await prisma.noteDrawing.findUnique({ where: { id } })
    if (!drawing) throw new Error("Updated drawing disappeared")
    await removeDrawingPreview(existing.previewPath)
    nextPreviewPath = null
    return Response.json({ success: true, data: serializeDrawing(drawing) })
  } catch (error) {
    if (nextPreviewPath) await removeDrawingPreview(nextPreviewPath)
    if (error instanceof DrawingValidationError || error instanceof ZodError) {
      return apiError(
        error instanceof ZodError ? error.issues[0]?.message || "Invalid drawing" : error.message,
        400,
        { code: "INVALID_DRAWING" }
      )
    }
    return apiRouteError(error, {
      fallbackMessage: "Failed to update drawing",
      fallbackCode: "DRAWING_UPDATE_FAILED",
      logLabel: "[note-drawings/update] failed",
    })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    await requireAuth()
    const { id: rawId } = await context.params
    const id = DrawingIdSchema.parse(rawId)
    const drawing = await prisma.noteDrawing.findUnique({ where: { id } })
    if (!drawing) return apiError("Drawing not found", 404, { code: "DRAWING_NOT_FOUND" })
    await prisma.noteDrawing.delete({ where: { id } })
    await removeDrawingPreview(drawing.previewPath)
    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message || "Invalid drawing", 400, { code: "INVALID_DRAWING" })
    }
    return apiRouteError(error, {
      fallbackMessage: "Failed to delete drawing",
      fallbackCode: "DRAWING_DELETE_FAILED",
      logLabel: "[note-drawings/delete] failed",
    })
  }
}
