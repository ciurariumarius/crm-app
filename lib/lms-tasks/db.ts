import { createHash } from "node:crypto"
import prisma from "@/lib/prisma"
import type { ClientAllocation, LmsModuleData, LmsSyncMode, LmsSyncSummary, TaskLog } from "@/lib/lms-tasks/types"

const CREATE_BATCH_SIZE = 400
const UPDATE_BATCH_SIZE = 120
const DELETE_BATCH_SIZE = 500

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

function isSyntheticSourceId(sourceId: string) {
  return /^row[-\s_]*\d+$/i.test(sourceId.trim())
}

function isoDateToUtcDate(isoDate: string | null) {
  return isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? new Date(`${isoDate}T00:00:00.000Z`)
    : null
}

function utcDateToIsoDate(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? null
}

export function buildTaskSyncKey(record: TaskLog) {
  const sourceId = (record.id || "").trim()
  if (sourceId && !isSyntheticSourceId(sourceId)) return `id:${normalizeText(sourceId)}`

  const fingerprint = [
    record.date || "",
    normalizeText(record.client),
    normalizeText(record.taskName),
    normalizeText(record.executant),
  ].join("|")
  return `fp:${createHash("sha1").update(fingerprint).digest("hex")}`
}

export function buildAllocationSyncKey(record: ClientAllocation) {
  return `client:${normalizeText(record.client)}`
}

export async function getLmsModuleData(): Promise<LmsModuleData> {
  const [tasks, allocations] = await Promise.all([
    prisma.lmsTaskLog.findMany({ orderBy: [{ taskDate: "desc" }, { updatedAt: "desc" }] }),
    prisma.lmsAllocation.findMany({ orderBy: { client: "asc" } }),
  ])
  const lastUpdated = [...tasks, ...allocations]
    .map((row) => row.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return {
    tasks: tasks.map((row) => ({
      id: row.sourceId || row.id,
      date: utcDateToIsoDate(row.taskDate),
      client: row.client,
      taskName: row.taskName,
      executant: row.executant,
      durationMinutes: row.durationMinutes,
      status: row.status,
    })),
    allocations: allocations.map((row) => ({
      client: row.client,
      specialist: row.specialist,
      seo: row.seo as ClientAllocation["seo"],
      gads: row.gads as ClientAllocation["gads"],
      fads: row.fads as ClientAllocation["fads"],
      tads: row.tads as ClientAllocation["tads"],
    })),
    lastUpdatedAt: lastUpdated?.toISOString() ?? null,
    tasksSourceFile: null,
    allocationsSourceFile: null,
  }
}

export async function syncLmsTasks(records: TaskLog[], mode: LmsSyncMode): Promise<LmsSyncSummary> {
  const incoming = new Map<string, TaskLog>()
  for (const record of records) incoming.set(buildTaskSyncKey(record), record)

  const existing = await prisma.lmsTaskLog.findMany()
  const existingByKey = new Map(existing.map((row) => [row.syncKey, row] as const))
  const creates: Array<{
    syncKey: string
    sourceId: string | null
    taskDate: Date | null
    client: string
    taskName: string
    executant: string
    durationMinutes: number
    status: string
  }> = []
  const updates: Array<{ id: string; data: (typeof creates)[number] }> = []
  let unchanged = 0

  for (const [syncKey, record] of incoming) {
    const data = {
      syncKey,
      sourceId: record.id?.trim() || null,
      taskDate: isoDateToUtcDate(record.date),
      client: record.client || "Unknown Client",
      taskName: record.taskName || "Untitled Task",
      executant: record.executant || "Unassigned",
      durationMinutes: Math.max(0, Math.round(record.durationMinutes || 0)),
      status: record.status || "-",
    }
    const current = existingByKey.get(syncKey)
    if (!current) {
      creates.push(data)
      continue
    }
    const changed =
      current.sourceId !== data.sourceId ||
      utcDateToIsoDate(current.taskDate) !== utcDateToIsoDate(data.taskDate) ||
      current.client !== data.client ||
      current.taskName !== data.taskName ||
      current.executant !== data.executant ||
      current.durationMinutes !== data.durationMinutes ||
      current.status !== data.status
    if (changed) updates.push({ id: current.id, data })
    else unchanged += 1
  }

  for (const chunk of chunkArray(creates, CREATE_BATCH_SIZE)) {
    await prisma.lmsTaskLog.createMany({ data: chunk })
  }
  for (const chunk of chunkArray(updates, UPDATE_BATCH_SIZE)) {
    await prisma.$transaction(chunk.map((row) => prisma.lmsTaskLog.update({ where: { id: row.id }, data: row.data })))
  }

  let deleted = 0
  if (mode === "replace") {
    const keepKeys = new Set(incoming.keys())
    const ids = existing.filter((row) => !keepKeys.has(row.syncKey)).map((row) => row.id)
    for (const chunk of chunkArray(ids, DELETE_BATCH_SIZE)) {
      deleted += (await prisma.lmsTaskLog.deleteMany({ where: { id: { in: chunk } } })).count
    }
  }

  return {
    created: creates.length,
    updated: updates.length,
    unchanged,
    deleted,
    totalIncoming: records.length,
    totalStored: await prisma.lmsTaskLog.count(),
  }
}

export async function syncLmsAllocations(
  records: ClientAllocation[],
  mode: LmsSyncMode
): Promise<LmsSyncSummary> {
  const incoming = new Map<string, ClientAllocation>()
  for (const record of records) incoming.set(buildAllocationSyncKey(record), record)

  const existing = await prisma.lmsAllocation.findMany()
  const existingByKey = new Map(existing.map((row) => [row.syncKey, row] as const))
  const creates: Array<{
    syncKey: string
    client: string
    specialist: string
    seo: string
    gads: string
    fads: string
    tads: string
  }> = []
  const updates: Array<{ id: string; data: Omit<(typeof creates)[number], "syncKey"> }> = []
  let unchanged = 0

  for (const [syncKey, record] of incoming) {
    const data = {
      client: record.client || "Unknown Client",
      specialist: record.specialist || "Unassigned",
      seo: record.seo || "-",
      gads: record.gads || "-",
      fads: record.fads || "-",
      tads: record.tads || "-",
    }
    const current = existingByKey.get(syncKey)
    if (!current) {
      creates.push({ syncKey, ...data })
      continue
    }
    const changed = Object.entries(data).some(
      ([key, value]) => current[key as keyof typeof data] !== value
    )
    if (changed) updates.push({ id: current.id, data })
    else unchanged += 1
  }

  for (const chunk of chunkArray(creates, CREATE_BATCH_SIZE)) {
    await prisma.lmsAllocation.createMany({ data: chunk })
  }
  for (const chunk of chunkArray(updates, UPDATE_BATCH_SIZE)) {
    await prisma.$transaction(chunk.map((row) => prisma.lmsAllocation.update({ where: { id: row.id }, data: row.data })))
  }

  let deleted = 0
  if (mode === "replace") {
    const keepKeys = new Set(incoming.keys())
    const ids = existing.filter((row) => !keepKeys.has(row.syncKey)).map((row) => row.id)
    for (const chunk of chunkArray(ids, DELETE_BATCH_SIZE)) {
      deleted += (await prisma.lmsAllocation.deleteMany({ where: { id: { in: chunk } } })).count
    }
  }

  return {
    created: creates.length,
    updated: updates.length,
    unchanged,
    deleted,
    totalIncoming: records.length,
    totalStored: await prisma.lmsAllocation.count(),
  }
}
