import { randomUUID } from "node:crypto"
import { ZodError } from "zod"
import { requireAuth } from "@/lib/auth"
import { apiError, apiRouteError } from "@/lib/api-response"
import prisma from "@/lib/prisma"
import {
  assertDrawingOwnerExists,
  DrawingValidationError,
  ownerCreateData,
  parseDrawingPayload,
  removeDrawingPreview,
  serializeDrawing,
  writeDrawingPreview,
} from "@/lib/notes/drawings.server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let previewPath: string | null = null
  try {
    await requireAuth()
    const payload = parseDrawingPayload(await request.formData())
    await assertDrawingOwnerExists(payload.owner)

    const id = randomUUID()
    previewPath = await writeDrawingPreview(payload.preview, id, {
      width: payload.width,
      height: payload.height,
    })
    const drawing = await prisma.noteDrawing.create({
      data: {
        id,
        ...ownerCreateData(payload.owner),
        strokeData: payload.strokeData,
        previewPath,
        canvasWidth: payload.width,
        canvasHeight: payload.height,
      },
    })

    return Response.json({ success: true, data: serializeDrawing(drawing) }, { status: 201 })
  } catch (error) {
    if (previewPath) await removeDrawingPreview(previewPath)
    if (error instanceof DrawingValidationError || error instanceof ZodError) {
      return apiError(
        error instanceof ZodError ? error.issues[0]?.message || "Invalid drawing" : error.message,
        400,
        { code: "INVALID_DRAWING" }
      )
    }
    return apiRouteError(error, {
      fallbackMessage: "Failed to save drawing",
      fallbackCode: "DRAWING_CREATE_FAILED",
      logLabel: "[note-drawings/create] failed",
    })
  }
}
