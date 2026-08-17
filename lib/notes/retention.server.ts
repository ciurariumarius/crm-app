import prisma from "@/lib/prisma"
import { getNoteRetentionCutoff } from "@/lib/notes/apple-notes"
import { extractDrawingIds, removeDrawingPreview } from "@/lib/notes/drawings.server"

export type PurgeDeletedNotesOptions = {
  dryRun?: boolean
  now?: Date
}

export async function runDeletedNotesRetention({
  dryRun = false,
  now = new Date(),
}: PurgeDeletedNotesOptions = {}) {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid retention date")
  }

  const cutoff = getNoteRetentionCutoff(now)
  const candidates = await prisma.note.findMany({
    where: { deletedAt: { lte: cutoff } },
    select: { id: true, drawings: { select: { previewPath: true } } },
    orderBy: { deletedAt: "asc" },
  })

  if (!dryRun && candidates.length) {
    await prisma.note.deleteMany({
      where: { id: { in: candidates.map((note) => note.id) } },
    })
    await Promise.all(
      candidates.flatMap((note) => note.drawings.map((drawing) => removeDrawingPreview(drawing.previewPath)))
    )
  }

  const drawingCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const drawingCandidates = await prisma.noteDrawing.findMany({
    where: { updatedAt: { lte: drawingCutoff } },
    include: {
      note: { select: { content: true } },
      project: { select: { description: true } },
      task: { select: { description: true } },
    },
  })
  const unreferencedDrawings = drawingCandidates.filter((drawing) => {
    const content = drawing.note?.content ?? drawing.project?.description ?? drawing.task?.description ?? ""
    return !extractDrawingIds(content).has(drawing.id.toLowerCase())
  })

  if (!dryRun && unreferencedDrawings.length) {
    await prisma.noteDrawing.deleteMany({
      where: { id: { in: unreferencedDrawings.map((drawing) => drawing.id) } },
    })
    await Promise.all(unreferencedDrawings.map((drawing) => removeDrawingPreview(drawing.previewPath)))
  }

  return {
    dryRun,
    cutoff: cutoff.toISOString(),
    candidateCount: candidates.length,
    deletedCount: dryRun ? 0 : candidates.length,
    orphanDrawingCandidateCount: unreferencedDrawings.length,
    deletedDrawingCount: dryRun ? 0 : unreferencedDrawings.length,
  }
}
