import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type SqliteTable = { name: string }
type CountRow = { count: number | bigint }
type ForeignKeyIssue = { table: string; rowid: number | bigint | null; parent: string; fkid: number | bigint }

const GLOBAL_UNIQUENESS_CHECKS = [
  ["partner names", `SELECT COUNT(*) AS count FROM (SELECT name FROM partners GROUP BY name HAVING COUNT(*) > 1)`],
  ["site domains", `SELECT COUNT(*) AS count FROM (SELECT domain_name FROM sites GROUP BY domain_name HAVING COUNT(*) > 1)`],
  ["service names", `SELECT COUNT(*) AS count FROM (SELECT service_name FROM service_library GROUP BY service_name HAVING COUNT(*) > 1)`],
  ["LMS task sync keys", `SELECT COUNT(*) AS count FROM (SELECT sync_key FROM lms_task_logs GROUP BY sync_key HAVING COUNT(*) > 1)`],
  ["LMS allocation sync keys", `SELECT COUNT(*) AS count FROM (SELECT sync_key FROM lms_allocations GROUP BY sync_key HAVING COUNT(*) > 1)`],
  ["work-task normalized names", `SELECT COUNT(*) AS count FROM (SELECT normalized_name FROM lms_work_tasks GROUP BY normalized_name HAVING COUNT(*) > 1)`],
  ["note-folder names", `SELECT COUNT(*) AS count FROM (SELECT name FROM note_folders GROUP BY name HAVING COUNT(*) > 1)`],
  ["rollover periods", `SELECT COUNT(*) AS count FROM (SELECT source_project_id, target_year, target_month FROM project_rollovers GROUP BY source_project_id, target_year, target_month HAVING COUNT(*) > 1)`],
  ["automatic work-entry dates", `SELECT COUNT(*) AS count FROM (SELECT source_key, work_date FROM lms_work_entries WHERE source_key IS NOT NULL GROUP BY source_key, work_date HAVING COUNT(*) > 1)`],
] as const

function quoteIdentifier(value: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error(`Unsafe SQLite identifier: ${value}`)
  return `"${value}"`
}

async function count(sql: string) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql)
  return Number(rows[0]?.count ?? 0)
}

async function main() {
  const failures: string[] = []
  const tables = await prisma.$queryRawUnsafe<SqliteTable[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  )
  const tableNames = new Set(tables.map((table) => table.name))
  const userCount = await count(`SELECT COUNT(*) AS count FROM users`)
  if (userCount !== 1) failures.push(`expected exactly one user, found ${userCount}`)

  const tenantTableExists = tableNames.has("tenants")
  let tenantId: string | null = null
  if (tenantTableExists) {
    const tenants = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM tenants ORDER BY id`)
    if (tenants.length !== 1) failures.push(`expected exactly one tenant before migration, found ${tenants.length}`)
    tenantId = tenants[0]?.id ?? null

    if (tenantId) {
      for (const table of tables) {
        const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info(${quoteIdentifier(table.name)})`
        )
        if (!columns.some((column) => column.name === "tenant_id")) continue
        const mismatches = await count(
          `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table.name)} WHERE tenant_id IS NOT NULL AND tenant_id <> '${tenantId.replaceAll("'", "''")}'`
        )
        if (mismatches > 0) failures.push(`${table.name} contains ${mismatches} row(s) outside the sole tenant`)
      }
    }

    const ownerRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM users ORDER BY id`)
    const ownerId = ownerRows[0]?.id
    if (ownerId) {
      for (const tableName of ["time_logs", "notes", "note_folders", "lms_work_entries"]) {
        if (!tableNames.has(tableName)) continue
        const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info(${quoteIdentifier(tableName)})`
        )
        if (!columns.some((column) => column.name === "user_id")) continue
        const mismatches = await count(
          `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)} WHERE user_id IS NULL OR user_id <> '${ownerId.replaceAll("'", "''")}'`
        )
        if (mismatches > 0) failures.push(`${tableName} contains ${mismatches} row(s) outside the sole owner`)
      }
    }

    for (const [label, sql] of GLOBAL_UNIQUENESS_CHECKS) {
      const collisions = await count(sql)
      if (collisions > 0) failures.push(`${label} have ${collisions} global uniqueness collision(s)`)
    }
  }

  const foreignKeyIssues = await prisma.$queryRawUnsafe<ForeignKeyIssue[]>(`PRAGMA foreign_key_check`)
  if (foreignKeyIssues.length > 0) {
    failures.push(`foreign_key_check found ${foreignKeyIssues.length} issue(s)`)
  }

  const summary = {
    status: failures.length === 0 ? "ok" : "failed",
    schema: tenantTableExists ? "multi-tenant" : "single-owner",
    tenantCount: tenantTableExists ? await count(`SELECT COUNT(*) AS count FROM tenants`) : 0,
    userCount,
    tableCount: tables.length,
    foreignKeyIssues: foreignKeyIssues.length,
    failures,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (failures.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("single-owner preflight failed", error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
