import prisma from "@/lib/prisma"
import { getNoteRetentionCutoff } from "@/lib/notes/apple-notes"

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
    select: { id: true },
    orderBy: { deletedAt: "asc" },
  })

  if (!dryRun && candidates.length) {
    await prisma.note.deleteMany({
      where: { id: { in: candidates.map((note) => note.id) } },
    })
  }

  return {
    dryRun,
    cutoff: cutoff.toISOString(),
    candidateCount: candidates.length,
    deletedCount: dryRun ? 0 : candidates.length,
  }
}
