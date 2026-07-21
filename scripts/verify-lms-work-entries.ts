import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ExcelJS from "exceljs"
import { matchesLmsClientSearch } from "../lib/lms-work-entries/client-search"
import {
  DEFAULT_LMS_WORK_DURATION_MINUTES,
  LMS_WORK_DURATION_FALLBACK_SHORTCUTS,
  LMS_WORK_DURATION_PRESETS,
  buildLmsWorkDurationShortcuts,
  parseCustomLmsWorkDuration,
} from "../lib/lms-work-entries/duration-options"
import { rankLmsWorkOptionsByFrequency } from "../lib/lms-work-entries/frequent-options"
import { formatLmsWorkDateLabel, isValidDateOnly, normalizeDateRange } from "../lib/lms-work-entries/date"
import {
  canonicalizeLmsWorkTaskName,
  LMS_WORK_TASK_NAMES_WITH_TRAILING_SPACE,
} from "../lib/lms-work-entries/task-names"
import {
  buildLmsCrmExportBuffer,
  LMS_CRM_EXPORT_COLUMN_WIDTHS,
  LMS_CRM_EXPORT_HEADERS,
} from "../lib/lms-work-entries/export"

async function run() {
  assert.equal(isValidDateOnly("2026-02-28"), true)
  assert.equal(isValidDateOnly("2026-02-29"), false)
  assert.equal(isValidDateOnly("2024-02-29"), true)
  assert.equal(isValidDateOnly("2026-13-01"), false)
  assert.deepEqual(normalizeDateRange("2026-03-31", "2026-03-01"), {
    from: "2026-03-01",
    to: "2026-03-31",
  })
  assert.equal(formatLmsWorkDateLabel("2026-07-21", "2026-07-21"), "Today · 21 Jul 2026")
  assert.equal(formatLmsWorkDateLabel("2026-07-20", "2026-07-21"), "20 Jul 2026")
  assert.equal(formatLmsWorkDateLabel("", "2026-07-21"), "Today")

  const importedClients = Array.from({ length: 850 }, (_, index) => `client-${String(index + 1).padStart(3, "0")}.ro`)
  importedClients.push("Școala Exemplu.ro")
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "CLIENT-800")).length, 1)
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "școala")).length, 1)
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "missing-client")).length, 0)
  assert.deepEqual(Array.from(LMS_WORK_DURATION_PRESETS), [15, 30, 45, 60, 120, 150, 180, 240, 300, 360])
  assert.equal(DEFAULT_LMS_WORK_DURATION_MINUTES, 120)
  assert.deepEqual(Array.from(LMS_WORK_DURATION_FALLBACK_SHORTCUTS), [30, 60, 120, 180, 240, 360])
  assert.equal(parseCustomLmsWorkDuration("1"), 1)
  assert.equal(parseCustomLmsWorkDuration("1440"), 1440)
  assert.equal(parseCustomLmsWorkDuration(""), null)
  assert.equal(parseCustomLmsWorkDuration("0"), null)
  assert.equal(parseCustomLmsWorkDuration("30.5"), null)
  assert.equal(parseCustomLmsWorkDuration("1441"), null)
  assert.deepEqual(buildLmsWorkDurationShortcuts([]), [30, 60, 120, 180, 240, 360])
  assert.deepEqual(
    buildLmsWorkDurationShortcuts([
      { durationMinutes: 120, count: 2 },
      { durationMinutes: 75, count: 5 },
      { durationMinutes: 60, count: 5 },
      { durationMinutes: 0, count: 20 },
      { durationMinutes: 240, count: 0 },
    ]),
    [60, 75, 120, 30, 180, 240]
  )
  assert.deepEqual(
    rankLmsWorkOptionsByFrequency(
      [
        { id: "client-c", label: "Zulu" },
        { id: "client-a", label: "Alpha" },
        { id: "client-b", label: "Beta" },
      ],
      [
        { id: "client-c", count: 1 },
        { id: "client-b", count: 4 },
        { id: "client-a", count: 4 },
        { id: "missing", count: 20 },
        { id: null, count: 30 },
      ],
      (option) => option.label
    ).map((option) => option.id),
    ["client-a", "client-b", "client-c"]
  )
  assert.equal(canonicalizeLmsWorkTaskName("Meeting / videocall client"), "Meeting / videocall client ")
  assert.equal(canonicalizeLmsWorkTaskName("Meeting / videocall client "), "Meeting / videocall client ")
  assert.equal(canonicalizeLmsWorkTaskName("Custom task  "), "Custom task")
  assert.equal(LMS_WORK_TASK_NAMES_WITH_TRAILING_SPACE.length, 5)

  const workLogSource = readFileSync(resolve(process.cwd(), "components/lms-work-entries/lms-work-log-workspace.tsx"), "utf8")
  const workLogDbSource = readFileSync(resolve(process.cwd(), "lib/lms-work-entries/db.ts"), "utf8")
  const workTaskCatalogSource = readFileSync(resolve(process.cwd(), "components/lms-work-entries/lms-work-task-catalog.tsx"), "utf8")
  const workEntryActionsSource = readFileSync(resolve(process.cwd(), "lib/actions/lms-work-entries.ts"), "utf8")
  const prismaSchemaSource = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8")
  const taskOrderMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721180000_add_lms_work_task_order_and_defaults/migration.sql"),
    "utf8"
  )
  const exactTaskNamesMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721183000_preserve_exact_lms_task_names/migration.sql"),
    "utf8"
  )
  const dataWorkspaceSource = readFileSync(resolve(process.cwd(), "components/lms-tasks/lms-analysis-data-workspace.tsx"), "utf8")
  assert.doesNotMatch(workLogSource, /Manage tasks|Manage predefined tasks/)
  assert.doesNotMatch(workLogSource, /Capture client work quickly/)
  assert.doesNotMatch(workLogSource, /localStorage|LMS_WORK_DURATION_STORAGE_KEY/)
  assert.doesNotMatch(workLogSource, /_120px_150px/)
  assert.match(workLogSource, /\/lms-analysis\/data#task-catalog/)
  assert.match(workLogSource, /LMS_WORK_DURATION_PRESETS\.map/)
  assert.match(workLogSource, /DEFAULT_LMS_WORK_DURATION_MINUTES/)
  assert.match(workLogSource, /xl:grid-cols-\[minmax\(0,11fr\)_minmax\(420px,9fr\)\]/)
  assert.match(workLogSource, /xl:col-start-2 xl:row-span-2 xl:row-start-1/)
  assert.match(workLogSource, /xl:col-start-1 xl:row-start-2/)
  assert.match(workLogSource, /formatLmsWorkDateLabel/)
  assert.match(workLogSource, /Frequently used/)
  assert.match(workLogSource, /Frequently used clients/)
  assert.match(workLogSource, /Frequently used tasks/)
  assert.match(workLogSource, /Save work/)
  assert.match(workLogSource, /!hasSelectedClient/)
  assert.match(workLogSource, /!hasSelectedTask/)
  assert.match(workLogDbSource, /prisma\.lmsWorkEntry\.groupBy/)
  assert.match(workLogDbSource, /by: \["lmsAllocationId"\]/)
  assert.match(workLogDbSource, /by: \["taskTypeId"\]/)
  assert.match(workLogDbSource, /where: \{ tenantId: session\.tenantId, userId: session\.userId \}/)
  assert.match(workLogDbSource, /orderBy: \[\{ sortOrder: "asc" \}, \{ name: "asc" \}\]/)
  assert.match(workTaskCatalogSource, /draggable=\{canReorder\}/)
  assert.match(workTaskCatalogSource, /reorderLmsWorkTasks/)
  assert.match(workTaskCatalogSource, /Alt\+ArrowUp Alt\+ArrowDown/)
  assert.match(workEntryActionsSource, /export async function reorderLmsWorkTasks/)
  assert.match(workEntryActionsSource, /where: \{ id, tenantId: session\.tenantId \}/)
  assert.match(prismaSchemaSource, /sortOrder\s+Int\s+@default\(1000\)\s+@map\("sort_order"\)/)
  assert.match(taskOrderMigrationSource, /INSERT OR IGNORE INTO "lms_work_tasks"/)
  assert.match(exactTaskNamesMigrationSource, /UPDATE "lms_work_tasks"/)
  assert.match(exactTaskNamesMigrationSource, /UPDATE "lms_work_entries"/)
  for (const taskName of LMS_WORK_TASK_NAMES_WITH_TRAILING_SPACE) {
    assert.ok(exactTaskNamesMigrationSource.includes(`'${taskName}'`), `Missing exact CRM task name: ${taskName}`)
  }
  const extractedTaskNames = [
    "Acces in platforme",
    "Audit tracking",
    "Comunicare client / coleg - email / telefon",
    "Creare GA4 / GTM",
    "Debriefing client - ca urmare a auditului",
    "Dezvoltare",
    "Followup la tracking - ca urmare a debriefing-ului",
    "Meeting / videocall client",
    "Meeting / videocall intern",
    "Modificari in contul de GTM",
    "Reverificare tracking",
    "Setare server side tracking",
    "Setare tracking - alte sisteme de advertising",
    "Setare tracking facebook ads",
    "Setare tracking google ads",
    "Setare tracking google analitics",
    "Setare tracking tiktok ads",
    "Task-uri administrative",
    "Training intern",
    "Verificare / Setare / Modificare cookie consent",
  ]
  let previousTaskPosition = -1
  for (const taskName of extractedTaskNames) {
    const position = taskOrderMigrationSource.indexOf(`('${taskName}'`)
    assert.ok(position > previousTaskPosition, `Missing or out-of-order seeded task: ${taskName}`)
    previousTaskPosition = position
  }
  assert.doesNotMatch(dataWorkspaceSource, /TabsList|TabsTrigger|TabsContent/)
  assert.match(dataWorkspaceSource, /id="task-catalog"/)
  assert.match(dataWorkspaceSource, /id="imports"/)
  assert.match(dataWorkspaceSource, /id="import-logs"/)

  const buffer = await buildLmsCrmExportBuffer([
    {
      workDate: "2026-03-12",
      clientDomainSnapshot: "example.ro",
      taskNameSnapshot: "Meeting / videocall client ",
      employeeNameSnapshot: "Marius Ciurariu",
      durationMinutes: 60,
    },
    {
      workDate: "2026-03-13",
      clientDomainSnapshot: "[Intern]",
      taskNameSnapshot: "Comunicare client / coleg - email / telefon",
      employeeNameSnapshot: "Marius Ciurariu",
      durationMinutes: 45,
    },
  ])
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Worksheet"])

  const sheet = workbook.getWorksheet("Worksheet")
  assert.ok(sheet)
  assert.equal(sheet.actualRowCount, 3)
  assert.equal(sheet.actualColumnCount, 41)
  const headerValues = sheet.getRow(1).values
  assert.ok(Array.isArray(headerValues))
  assert.deepEqual(headerValues.slice(1), Array.from(LMS_CRM_EXPORT_HEADERS))
  assert.equal(sheet.getCell("A2").value, null)
  assert.equal(sheet.getCell("B2").value, "2026-03-12")
  assert.equal(sheet.getCell("B2").numFmt, "@")
  assert.equal(sheet.getCell("C2").value, "example.ro")
  assert.equal(sheet.getCell("D2").value, "Meeting / videocall client ")
  assert.equal(sheet.getCell("E2").value, "DATA Subdivizie")
  assert.equal(sheet.getCell("F2").value, "Marius Ciurariu")
  assert.equal(sheet.getCell("G2").value, "Marius Ciurariu")
  assert.equal(sheet.getCell("H2").value, "Finalizat")
  assert.equal(sheet.getCell("I2").value, null)
  assert.equal(sheet.getCell("J2").value, 60)
  assert.equal(sheet.getCell("AO2").value, null)
  assert.equal(sheet.getCell("B3").value, "2026-03-13")

  for (const [index, expected] of LMS_CRM_EXPORT_COLUMN_WIDTHS.entries()) {
    assert.ok(Math.abs((sheet.getColumn(index + 1).width ?? 0) - expected) < 0.01)
  }

  const table = sheet.getTable("CRMConsolidatedWithCommunication2026")
  const tableModel = (table as unknown as {
    table: { tableRef: string; columns: unknown[]; style: { theme: string; showRowStripes: boolean } }
  }).table
  assert.equal(tableModel.tableRef, "A1:AO3")
  assert.equal(tableModel.columns.length, 41)
  assert.equal(tableModel.style.theme, "TableStyleMedium2")
  assert.equal(tableModel.style.showRowStripes, true)

  process.stdout.write("verify-lms-work-entries: ok\n")
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
