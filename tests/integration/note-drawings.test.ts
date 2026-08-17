import { execFileSync } from "node:child_process"
import { closeSync, existsSync, mkdtempSync, openSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PrismaClient } from "@prisma/client"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { NoteDrawingDocument, NoteDrawingRecord } from "@/lib/notes/drawings"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "note-drawing-owner",
    username: "note-drawing-owner",
    twoFactorVerified: true,
  })),
}))

type CreateRoute = typeof import("@/app/api/note-drawings/route")
type DrawingRoute = typeof import("@/app/api/note-drawings/[id]/route")

let temporaryDirectory = ""
let prisma: PrismaClient
let createRoute: CreateRoute
let drawingRoute: DrawingRoute
let previewPng: Buffer

const document: NoteDrawingDocument = {
  version: 1,
  strokes: [{ id: "stroke-1", tool: "pen", color: "#17201c", size: 10, points: [[0.1, 0.1, 0.5], [0.4, 0.5, 0.8]] }],
}

function drawingForm(noteId: string, expectedUpdatedAt?: string) {
  const form = new FormData()
  form.set("owner", JSON.stringify({ type: "note", id: noteId }))
  form.set("strokeData", JSON.stringify(document))
  form.set("canvasWidth", "1200")
  form.set("canvasHeight", "800")
  form.set("preview", new File([new Uint8Array(previewPng)], "drawing.png", { type: "image/png" }))
  if (expectedUpdatedAt) form.set("expectedUpdatedAt", expectedUpdatedAt)
  return form
}

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "crm-note-drawings-"))
  const databasePath = join(temporaryDirectory, "note-drawings.db")
  closeSync(openSync(databasePath, "w"))
  process.env.DATABASE_URL = `file:${databasePath}`
  process.env.PROJECT_NOTES_STORAGE_ROOT = join(temporaryDirectory, "storage")
  process.env.PROJECT_NOTES_SIGNING_SECRET = "note-drawing-integration-secret"

  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  })

  previewPng = await sharp({ create: { width: 1200, height: 800, channels: 4, background: "white" } }).png().toBuffer()
  prisma = (await import("@/lib/prisma")).default
  createRoute = await import("@/app/api/note-drawings/route")
  drawingRoute = await import("@/app/api/note-drawings/[id]/route")
})

afterAll(async () => {
  await prisma?.$disconnect()
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true })
})

describe("editable note drawings", () => {
  it("creates, loads, updates with conflict protection, and deletes a drawing preview", async () => {
    const folder = await prisma.noteFolder.create({ data: { name: "General", isDefault: true } })
    const note = await prisma.note.create({ data: { folderId: folder.id, title: "Drawing note", content: "", contentText: "" } })

    const createdResponse = await createRoute.POST(new Request("http://localhost/api/note-drawings", { method: "POST", body: drawingForm(note.id) }))
    expect(createdResponse.status).toBe(201)
    const createdPayload = await createdResponse.json() as { data: NoteDrawingRecord }
    expect(createdPayload.data.owner).toEqual({ type: "note", id: note.id })
    const stored = await prisma.noteDrawing.findUniqueOrThrow({ where: { id: createdPayload.data.id } })
    expect(existsSync(join(process.env.PROJECT_NOTES_STORAGE_ROOT!, stored.previewPath))).toBe(true)

    const context = { params: Promise.resolve({ id: stored.id }) }
    const getResponse = await drawingRoute.GET(new Request("http://localhost"), context)
    expect(getResponse.status).toBe(200)

    await new Promise((resolve) => setTimeout(resolve, 5))
    const updatedResponse = await drawingRoute.PATCH(new Request("http://localhost", { method: "PATCH", body: drawingForm(note.id, createdPayload.data.updatedAt) }), context)
    expect(updatedResponse.status).toBe(200)

    const conflictResponse = await drawingRoute.PATCH(new Request("http://localhost", { method: "PATCH", body: drawingForm(note.id, createdPayload.data.updatedAt) }), context)
    expect(conflictResponse.status).toBe(409)
    await expect(conflictResponse.json()).resolves.toMatchObject({ code: "DRAWING_CONFLICT" })

    await prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } })
    expect(await prisma.noteDrawing.count({ where: { id: stored.id } })).toBe(1)

    const current = await prisma.noteDrawing.findUniqueOrThrow({ where: { id: stored.id } })
    const deleteResponse = await drawingRoute.DELETE(new Request("http://localhost"), context)
    expect(deleteResponse.status).toBe(200)
    expect(await prisma.noteDrawing.count({ where: { id: stored.id } })).toBe(0)
    expect(existsSync(join(process.env.PROJECT_NOTES_STORAGE_ROOT!, current.previewPath))).toBe(false)
  })

  it("rejects missing owners and non-PNG previews", async () => {
    const missingOwnerForm = drawingForm("00000000-0000-4000-8000-000000000000")
    const missingOwner = await createRoute.POST(new Request("http://localhost", { method: "POST", body: missingOwnerForm }))
    expect(missingOwner.status).toBe(400)

    const folder = await prisma.noteFolder.findFirstOrThrow()
    const note = await prisma.note.create({ data: { folderId: folder.id, title: "Bad preview", content: "", contentText: "" } })
    const invalid = drawingForm(note.id)
    invalid.set("preview", new File([new TextEncoder().encode("not png")], "drawing.png", { type: "image/png" }))
    const invalidPreview = await createRoute.POST(new Request("http://localhost", { method: "POST", body: invalid }))
    expect(invalidPreview.status).toBe(400)
  })
})
