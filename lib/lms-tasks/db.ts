import { createHash, randomUUID } from "node:crypto"
import prisma from "@/lib/prisma"
import type { ClientAllocation, LmsModuleData, LmsSyncMode, LmsSyncSummary, TaskLog } from "@/lib/lms-tasks/types"

const CREATE_BATCH_SIZE = 400
const UPDATE_BATCH_SIZE = 120
const DELETE_BATCH_SIZE = 500

type TaskStoreRow = {
  id: string
  syncKey: string
  sourceId: string | null
  taskDate: Date | null
  client: string
  taskName: string
  executant: string
  durationMinutes: number
  status: string
  updatedAt: Date | null
}

type AllocationStoreRow = {
  id: string
  syncKey: string
  client: string
  specialist: string
  seo: string
  gads: string
  fads: string
  tads: string
  updatedAt: Date | null
}

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

function hashSha1(input: string) {
  return createHash("sha1").update(input).digest("hex")
}

function chunkArray<T>(items: T[], chunkSize: number) {
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

function isSyntheticSourceId(sourceId: string) {
  return /^row[-\s_]*\d+$/i.test(sourceId.trim())
}

function toDateOrNull(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isoDateToUtcDate(isoDate: string | null) {
  if (!isoDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  return new Date(`${isoDate}T00:00:00.000Z`)
}

function utcDateToIsoDate(date: Date | null) {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

function getTaskDelegate() {
  const candidate = (prisma as unknown as { lmsTaskLog?: unknown }).lmsTaskLog as
    | {
        findMany: (args: unknown) => Promise<unknown[]>
        createMany: (args: unknown) => Promise<unknown>
        update: (args: unknown) => Promise<unknown>
        deleteMany: (args: unknown) => Promise<{ count: number }>
        count: (args: unknown) => Promise<number>
      }
    | undefined
  if (!candidate || typeof candidate.findMany !== "function") return null
  return candidate
}

function getAllocationDelegate() {
  const candidate = (prisma as unknown as { lmsAllocation?: unknown }).lmsAllocation as
    | {
        findMany: (args: unknown) => Promise<unknown[]>
        createMany: (args: unknown) => Promise<unknown>
        update: (args: unknown) => Promise<unknown>
        deleteMany: (args: unknown) => Promise<{ count: number }>
        count: (args: unknown) => Promise<number>
      }
    | undefined
  if (!candidate || typeof candidate.findMany !== "function") return null
  return candidate
}

async function findTaskRows(tenantId: string): Promise<TaskStoreRow[]> {
  const delegate = getTaskDelegate()
  if (delegate) {
    const rows = (await delegate.findMany({
      where: { tenantId },
      orderBy: [{ taskDate: "desc" }, { updatedAt: "desc" }],
    })) as Array<{
      id: string
      syncKey: string
      sourceId: string | null
      taskDate: Date | null
      client: string
      taskName: string
      executant: string
      durationMinutes: number
      status: string
      updatedAt: Date
    }>

    return rows.map((row) => ({
      ...row,
      taskDate: toDateOrNull(row.taskDate),
      updatedAt: toDateOrNull(row.updatedAt),
    }))
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      syncKey: string
      sourceId: string | null
      taskDate: string | null
      client: string
      taskName: string
      executant: string
      durationMinutes: number
      status: string
      updatedAt: string | null
    }>
  >`
    SELECT
      id,
      sync_key AS "syncKey",
      source_id AS "sourceId",
      task_date AS "taskDate",
      client,
      task_name AS "taskName",
      executant,
      duration_minutes AS "durationMinutes",
      status,
      updated_at AS "updatedAt"
    FROM lms_task_logs
    WHERE tenant_id = ${tenantId}
    ORDER BY task_date DESC, updated_at DESC
  `

  return rows.map((row) => ({
    ...row,
    taskDate: toDateOrNull(row.taskDate),
    updatedAt: toDateOrNull(row.updatedAt),
  }))
}

async function findAllocationRows(tenantId: string): Promise<AllocationStoreRow[]> {
  const delegate = getAllocationDelegate()
  if (delegate) {
    const rows = (await delegate.findMany({
      where: { tenantId },
      orderBy: [{ client: "asc" }],
    })) as Array<{
      id: string
      syncKey: string
      client: string
      specialist: string
      seo: string
      gads: string
      fads: string
      tads: string
      updatedAt: Date
    }>

    return rows.map((row) => ({
      ...row,
      updatedAt: toDateOrNull(row.updatedAt),
    }))
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      syncKey: string
      client: string
      specialist: string
      seo: string
      gads: string
      fads: string
      tads: string
      updatedAt: string | null
    }>
  >`
    SELECT
      id,
      sync_key AS "syncKey",
      client,
      specialist,
      seo,
      gads,
      fads,
      tads,
      updated_at AS "updatedAt"
    FROM lms_allocations
    WHERE tenant_id = ${tenantId}
    ORDER BY client ASC
  `

  return rows.map((row) => ({
    ...row,
    updatedAt: toDateOrNull(row.updatedAt),
  }))
}

async function createTaskRows(
  rows: Array<{
    tenantId: string
    syncKey: string
    sourceId: string | null
    taskDate: Date | null
    client: string
    taskName: string
    executant: string
    durationMinutes: number
    status: string
  }>
) {
  if (rows.length === 0) return
  const delegate = getTaskDelegate()
  if (delegate) {
    await delegate.createMany({ data: rows })
    return
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.$executeRaw`
        INSERT INTO lms_task_logs (
          id, tenant_id, sync_key, source_id, task_date, client, task_name, executant, duration_minutes, status
        )
        VALUES (
          ${randomUUID()},
          ${row.tenantId},
          ${row.syncKey},
          ${row.sourceId},
          ${row.taskDate},
          ${row.client},
          ${row.taskName},
          ${row.executant},
          ${row.durationMinutes},
          ${row.status}
        )
      `
    )
  )
}

async function updateTaskRows(
  tenantId: string,
  rows: Array<{
    id: string
    data: {
      sourceId: string | null
      taskDate: Date | null
      client: string
      taskName: string
      executant: string
      durationMinutes: number
      status: string
    }
  }>
) {
  if (rows.length === 0) return
  const delegate = getTaskDelegate()
  if (delegate) {
    await prisma.$transaction(
      rows.map((row) =>
        prisma.lmsTaskLog.update({
          where: { id: row.id },
          data: row.data,
        })
      )
    )
    return
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.$executeRaw`
        UPDATE lms_task_logs
        SET
          source_id = ${row.data.sourceId},
          task_date = ${row.data.taskDate},
          client = ${row.data.client},
          task_name = ${row.data.taskName},
          executant = ${row.data.executant},
          duration_minutes = ${row.data.durationMinutes},
          status = ${row.data.status},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${row.id} AND tenant_id = ${tenantId}
      `
    )
  )
}

async function deleteTaskRowsByIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return 0
  const delegate = getTaskDelegate()
  if (delegate) {
    const result = await delegate.deleteMany({
      where: {
        tenantId,
        id: { in: ids },
      },
    })
    return result.count
  }

  await prisma.$transaction(
    ids.map((id) =>
      prisma.$executeRaw`
        DELETE FROM lms_task_logs
        WHERE tenant_id = ${tenantId} AND id = ${id}
      `
    )
  )
  return ids.length
}

async function countTaskRows(tenantId: string) {
  const delegate = getTaskDelegate()
  if (delegate) {
    return delegate.count({ where: { tenantId } })
  }

  const rows = await prisma.$queryRaw<Array<{ count: number | string }>>`
    SELECT COUNT(*) AS count
    FROM lms_task_logs
    WHERE tenant_id = ${tenantId}
  `
  return Number(rows[0]?.count ?? 0)
}

async function createAllocationRows(
  rows: Array<{
    tenantId: string
    syncKey: string
    client: string
    specialist: string
    seo: string
    gads: string
    fads: string
    tads: string
  }>
) {
  if (rows.length === 0) return
  const delegate = getAllocationDelegate()
  if (delegate) {
    await delegate.createMany({ data: rows })
    return
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.$executeRaw`
        INSERT INTO lms_allocations (
          id, tenant_id, sync_key, client, specialist, seo, gads, fads, tads
        )
        VALUES (
          ${randomUUID()},
          ${row.tenantId},
          ${row.syncKey},
          ${row.client},
          ${row.specialist},
          ${row.seo},
          ${row.gads},
          ${row.fads},
          ${row.tads}
        )
      `
    )
  )
}

async function updateAllocationRows(
  tenantId: string,
  rows: Array<{
    id: string
    data: {
      client: string
      specialist: string
      seo: string
      gads: string
      fads: string
      tads: string
    }
  }>
) {
  if (rows.length === 0) return
  const delegate = getAllocationDelegate()
  if (delegate) {
    await prisma.$transaction(
      rows.map((row) =>
        prisma.lmsAllocation.update({
          where: { id: row.id },
          data: row.data,
        })
      )
    )
    return
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.$executeRaw`
        UPDATE lms_allocations
        SET
          client = ${row.data.client},
          specialist = ${row.data.specialist},
          seo = ${row.data.seo},
          gads = ${row.data.gads},
          fads = ${row.data.fads},
          tads = ${row.data.tads},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${row.id} AND tenant_id = ${tenantId}
      `
    )
  )
}

async function deleteAllocationRowsByIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return 0
  const delegate = getAllocationDelegate()
  if (delegate) {
    const result = await delegate.deleteMany({
      where: {
        tenantId,
        id: { in: ids },
      },
    })
    return result.count
  }

  await prisma.$transaction(
    ids.map((id) =>
      prisma.$executeRaw`
        DELETE FROM lms_allocations
        WHERE tenant_id = ${tenantId} AND id = ${id}
      `
    )
  )
  return ids.length
}

async function countAllocationRows(tenantId: string) {
  const delegate = getAllocationDelegate()
  if (delegate) {
    return delegate.count({ where: { tenantId } })
  }

  const rows = await prisma.$queryRaw<Array<{ count: number | string }>>`
    SELECT COUNT(*) AS count
    FROM lms_allocations
    WHERE tenant_id = ${tenantId}
  `
  return Number(rows[0]?.count ?? 0)
}

function areTaskRowsDifferent(
  existing: {
    sourceId: string | null
    taskDate: Date | null
    client: string
    taskName: string
    executant: string
    durationMinutes: number
    status: string
  },
  incoming: {
    sourceId: string | null
    taskDate: Date | null
    client: string
    taskName: string
    executant: string
    durationMinutes: number
    status: string
  }
) {
  return (
    (existing.sourceId || null) !== (incoming.sourceId || null) ||
    utcDateToIsoDate(existing.taskDate) !== utcDateToIsoDate(incoming.taskDate) ||
    existing.client !== incoming.client ||
    existing.taskName !== incoming.taskName ||
    existing.executant !== incoming.executant ||
    existing.durationMinutes !== incoming.durationMinutes ||
    existing.status !== incoming.status
  )
}

function areAllocationRowsDifferent(
  existing: {
    client: string
    specialist: string
    seo: string
    gads: string
    fads: string
    tads: string
  },
  incoming: {
    client: string
    specialist: string
    seo: string
    gads: string
    fads: string
    tads: string
  }
) {
  return (
    existing.client !== incoming.client ||
    existing.specialist !== incoming.specialist ||
    existing.seo !== incoming.seo ||
    existing.gads !== incoming.gads ||
    existing.fads !== incoming.fads ||
    existing.tads !== incoming.tads
  )
}

export function buildTaskSyncKey(record: TaskLog) {
  const sourceId = (record.id || "").trim()
  if (sourceId && !isSyntheticSourceId(sourceId)) {
    return `id:${normalizeText(sourceId)}`
  }

  const fingerprintSource = [
    record.date || "",
    normalizeText(record.client),
    normalizeText(record.taskName),
    normalizeText(record.executant),
  ].join("|")
  return `fp:${hashSha1(fingerprintSource)}`
}

export function buildAllocationSyncKey(record: ClientAllocation) {
  return `client:${normalizeText(record.client)}`
}

export async function getLmsModuleDataForTenant(tenantId: string): Promise<LmsModuleData> {
  const [tasksRaw, allocationsRaw] = await Promise.all([findTaskRows(tenantId), findAllocationRows(tenantId)])

  const lastUpdated = [...tasksRaw.map((row) => row.updatedAt), ...allocationsRaw.map((row) => row.updatedAt)]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return {
    tasks: tasksRaw.map((row) => ({
      id: row.sourceId || row.id,
      date: utcDateToIsoDate(row.taskDate),
      client: row.client,
      taskName: row.taskName,
      executant: row.executant,
      durationMinutes: row.durationMinutes,
      status: row.status,
    })),
    allocations: allocationsRaw.map((row) => ({
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

export async function syncLmsTasksForTenant(tenantId: string, records: TaskLog[], mode: LmsSyncMode): Promise<LmsSyncSummary> {
  const dedupedIncomingBySyncKey = new Map<string, TaskLog>()
  for (const record of records) {
    const syncKey = buildTaskSyncKey(record)
    dedupedIncomingBySyncKey.set(syncKey, record)
  }

  const dedupedRecords = Array.from(dedupedIncomingBySyncKey.entries()).map(([syncKey, record]) => ({ syncKey, record }))
  const existing = await findTaskRows(tenantId)
  const existingByKey = new Map(existing.map((row) => [row.syncKey, row] as const))

  const createRows: Array<{
    tenantId: string
    syncKey: string
    sourceId: string | null
    taskDate: Date | null
    client: string
    taskName: string
    executant: string
    durationMinutes: number
    status: string
  }> = []
  const updateRows: Array<{
    id: string
    data: {
      sourceId: string | null
      taskDate: Date | null
      client: string
      taskName: string
      executant: string
      durationMinutes: number
      status: string
    }
  }> = []
  let unchanged = 0

  for (const { syncKey, record } of dedupedRecords) {
    const mapped = {
      sourceId: record.id?.trim() || null,
      taskDate: isoDateToUtcDate(record.date),
      client: record.client || "Unknown Client",
      taskName: record.taskName || "Untitled Task",
      executant: record.executant || "Unassigned",
      durationMinutes: Math.max(0, Math.round(record.durationMinutes || 0)),
      status: record.status || "-",
    }

    const existingRow = existingByKey.get(syncKey)
    if (!existingRow) {
      createRows.push({
        tenantId,
        syncKey,
        ...mapped,
      })
      continue
    }

    if (areTaskRowsDifferent(existingRow, mapped)) {
      updateRows.push({ id: existingRow.id, data: mapped })
    } else {
      unchanged += 1
    }
  }

  let deleted = 0
  const createChunks = chunkArray(createRows, CREATE_BATCH_SIZE)
  for (const chunk of createChunks) {
    await createTaskRows(chunk)
  }

  const updateChunks = chunkArray(updateRows, UPDATE_BATCH_SIZE)
  for (const chunk of updateChunks) {
    await updateTaskRows(tenantId, chunk)
  }

  if (mode === "replace") {
    const keepKeys = new Set(dedupedRecords.map((entry) => entry.syncKey))
    const idsToDelete = existing.filter((row) => !keepKeys.has(row.syncKey)).map((row) => row.id)
    const deleteChunks = chunkArray(idsToDelete, DELETE_BATCH_SIZE)
    for (const idsChunk of deleteChunks) {
      deleted += await deleteTaskRowsByIds(tenantId, idsChunk)
    }
  }

  const totalStored = await countTaskRows(tenantId)
  return {
    created: createRows.length,
    updated: updateRows.length,
    unchanged,
    deleted,
    totalIncoming: records.length,
    totalStored,
  }
}

export async function syncLmsAllocationsForTenant(
  tenantId: string,
  records: ClientAllocation[],
  mode: LmsSyncMode
): Promise<LmsSyncSummary> {
  const dedupedIncomingBySyncKey = new Map<string, ClientAllocation>()
  for (const record of records) {
    dedupedIncomingBySyncKey.set(buildAllocationSyncKey(record), record)
  }
  const dedupedRecords = Array.from(dedupedIncomingBySyncKey.entries()).map(([syncKey, record]) => ({ syncKey, record }))

  const existing = await findAllocationRows(tenantId)
  const existingByKey = new Map(existing.map((row) => [row.syncKey, row] as const))

  const createRows: Array<{
    tenantId: string
    syncKey: string
    client: string
    specialist: string
    seo: string
    gads: string
    fads: string
    tads: string
  }> = []
  const updateRows: Array<{
    id: string
    data: {
      client: string
      specialist: string
      seo: string
      gads: string
      fads: string
      tads: string
    }
  }> = []
  let unchanged = 0

  for (const { syncKey, record } of dedupedRecords) {
    const mapped = {
      client: record.client || "Unknown Client",
      specialist: record.specialist || "Unassigned",
      seo: record.seo || "-",
      gads: record.gads || "-",
      fads: record.fads || "-",
      tads: record.tads || "-",
    }
    const existingRow = existingByKey.get(syncKey)
    if (!existingRow) {
      createRows.push({ tenantId, syncKey, ...mapped })
      continue
    }

    if (areAllocationRowsDifferent(existingRow, mapped)) {
      updateRows.push({ id: existingRow.id, data: mapped })
    } else {
      unchanged += 1
    }
  }

  let deleted = 0
  const createChunks = chunkArray(createRows, CREATE_BATCH_SIZE)
  for (const chunk of createChunks) {
    await createAllocationRows(chunk)
  }

  const updateChunks = chunkArray(updateRows, UPDATE_BATCH_SIZE)
  for (const chunk of updateChunks) {
    await updateAllocationRows(tenantId, chunk)
  }

  if (mode === "replace") {
    const keepKeys = new Set(dedupedRecords.map((entry) => entry.syncKey))
    const idsToDelete = existing.filter((row) => !keepKeys.has(row.syncKey)).map((row) => row.id)
    const deleteChunks = chunkArray(idsToDelete, DELETE_BATCH_SIZE)
    for (const idsChunk of deleteChunks) {
      deleted += await deleteAllocationRowsByIds(tenantId, idsChunk)
    }
  }

  const totalStored = await countAllocationRows(tenantId)
  return {
    created: createRows.length,
    updated: updateRows.length,
    unchanged,
    deleted,
    totalIncoming: records.length,
    totalStored,
  }
}
