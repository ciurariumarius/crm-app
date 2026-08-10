import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ExcelJS from "exceljs"
import { buildLmsAllocationSyncKey } from "../lib/lms-tasks/client-key"
import { matchesLmsClientSearch } from "../lib/lms-work-entries/client-search"
import { LMS_CRM_EMPLOYEE_NAME } from "../lib/lms-work-entries/crm-template"
import {
  LMS_WORK_DURATION_FALLBACK_SHORTCUTS,
  LMS_WORK_DURATION_PRESETS,
  buildLmsWorkDurationShortcuts,
  formatCompactLmsWorkDuration,
  getLmsWorkDefaultDurationSelection,
  getLmsWorkUtilizationPercent,
  parseCustomLmsWorkDuration,
} from "../lib/lms-work-entries/duration-options"
import {
  mergeLmsWorkOptionShortcuts,
  rankLmsWorkOptionsByFrequency,
} from "../lib/lms-work-entries/frequent-options"
import {
  LMS_WORK_EXPORT_STATUSES,
  buildLmsWorkEntryWhere,
  normalizeLmsWorkDateFilter,
  normalizeLmsWorkExportStatus,
} from "../lib/lms-work-entries/filters"
import {
  DEFAULT_LMS_WORK_LOG_PAGE_SIZE,
  LMS_WORK_LOG_PAGE_SIZES,
  normalizeLmsWorkLogPageSize,
} from "../lib/lms-work-entries/pagination"
import {
  addDateOnlyDays,
  addLmsWorkdays,
  formatLmsWorkDateLabel,
  getBucharestDateOnly,
  getDateOnlyRange,
  getDefaultLmsWorkDate,
  getLmsWorkCapacity,
  getLmsWorkWeekDates,
  isRomanianWorkday,
  isRomanianLegalHoliday,
  isValidDateOnly,
  normalizeDateRange,
} from "../lib/lms-work-entries/date"
import { LMS_RECURRENCE_SOURCE_PREFIX } from "../lib/lms-work-entries/daily-admin-automation"
import {
  LMS_STANDARD_WORK_WEEK_MINUTES,
  formatRecurrenceSchedule,
  getLmsRecurrenceWeeklyMinutes,
  maskToWeekdays,
  recurrenceRunsOnDate,
  weekdaysToMask,
} from "../lib/lms-work-entries/recurrence"
import { getRomanianLegalHolidayDates, getRomanianOrthodoxEaster } from "../lib/lms-work-entries/romanian-holidays"
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
  assert.equal(getBucharestDateOnly(new Date("2026-07-20T21:30:00.000Z")), "2026-07-21")
  assert.equal(getBucharestDateOnly(new Date("2026-12-31T22:30:00.000Z")), "2027-01-01")
  assert.equal(addDateOnlyDays("2024-02-28", 1), "2024-02-29")
  assert.equal(addDateOnlyDays("2026-01-01", -1), "2025-12-31")
  assert.equal(getDefaultLmsWorkDate("2026-08-08"), "2026-08-07")
  assert.equal(getDefaultLmsWorkDate("2026-08-09"), "2026-08-07")
  assert.equal(getDefaultLmsWorkDate("2026-08-10"), "2026-08-10")
  assert.deepEqual(getLmsWorkWeekDates("2026-08-04"), [
    "2026-08-03",
    "2026-08-04",
    "2026-08-05",
    "2026-08-06",
    "2026-08-07",
  ])
  assert.deepEqual(getLmsWorkWeekDates("2026-01-01"), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
  ])
  assert.equal(addLmsWorkdays("2026-08-10", -1), "2026-08-07")
  assert.equal(addLmsWorkdays("2026-08-07", 1), "2026-08-10")
  assert.deepEqual(getDateOnlyRange("2026-07-17", "2026-07-21"), [
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
    "2026-07-20",
    "2026-07-21",
  ])
  assert.equal(isRomanianWorkday("2026-07-17"), true)
  assert.equal(isRomanianWorkday("2026-07-18"), false)
  assert.equal(isRomanianWorkday("2026-01-01"), false)
  assert.equal(isRomanianWorkday("invalid"), false)
  assert.equal(isRomanianLegalHoliday("2026-12-01"), true)
  assert.equal(isRomanianLegalHoliday("2026-12-02"), false)
  assert.equal(getRomanianOrthodoxEaster(2024).toISOString().slice(0, 10), "2024-05-05")
  assert.equal(getRomanianOrthodoxEaster(2025).toISOString().slice(0, 10), "2025-04-20")
  assert.equal(getRomanianOrthodoxEaster(2026).toISOString().slice(0, 10), "2026-04-12")
  assert.deepEqual(
    ["2026-04-10", "2026-04-12", "2026-04-13", "2026-05-31", "2026-06-01"].map(
      (date) => getRomanianLegalHolidayDates(2026).has(date)
    ),
    [true, true, true, true, true]
  )
  assert.deepEqual(getLmsWorkCapacity("2026-07-01", "2026-07-21"), { workdays: 15, hours: 120, holidays: 0 })
  assert.deepEqual(getLmsWorkCapacity("2026-07-17", "2026-07-20"), { workdays: 2, hours: 16, holidays: 0 })
  assert.deepEqual(getLmsWorkCapacity("2026-07-18", "2026-07-19"), { workdays: 0, hours: 0, holidays: 0 })
  assert.deepEqual(getLmsWorkCapacity("2026-07-20", "2026-07-17"), { workdays: 2, hours: 16, holidays: 0 })
  assert.deepEqual(getLmsWorkCapacity("2026-01-01", "2026-01-07"), { workdays: 1, hours: 8, holidays: 4 })
  assert.deepEqual(getLmsWorkCapacity("2026-04-06", "2026-04-13"), { workdays: 4, hours: 32, holidays: 2 })
  assert.deepEqual(getLmsWorkCapacity("2026-01-01", "2026-12-31"), { workdays: 250, hours: 2000, holidays: 11 })
  assert.equal(getLmsWorkCapacity(null, null), null)
  assert.deepEqual(Array.from(LMS_WORK_LOG_PAGE_SIZES), [50, 100, 250])
  assert.equal(DEFAULT_LMS_WORK_LOG_PAGE_SIZE, 50)
  assert.equal(normalizeLmsWorkLogPageSize("50"), 50)
  assert.equal(normalizeLmsWorkLogPageSize("100"), 100)
  assert.equal(normalizeLmsWorkLogPageSize(250), 250)
  assert.equal(normalizeLmsWorkLogPageSize("25"), 50)
  assert.equal(normalizeLmsWorkLogPageSize("invalid"), 50)
  assert.deepEqual(Array.from(LMS_WORK_EXPORT_STATUSES), ["not-exported", "exported", "all"])
  assert.equal(normalizeLmsWorkExportStatus(undefined), "not-exported")
  assert.equal(normalizeLmsWorkExportStatus("exported"), "exported")
  assert.equal(normalizeLmsWorkExportStatus("all"), "all")
  assert.equal(normalizeLmsWorkExportStatus("invalid"), "not-exported")
  assert.equal(normalizeLmsWorkDateFilter(" 2026-08-05 "), "2026-08-05")
  assert.equal(normalizeLmsWorkDateFilter("2026-02-29"), null)
  assert.equal(normalizeLmsWorkDateFilter("2026-07-31", "2026-08-01", "2026-08-10"), null)
  assert.equal(normalizeLmsWorkDateFilter("2026-08-11", "2026-08-01", "2026-08-10"), null)
  assert.equal(normalizeLmsWorkDateFilter("2026-08-05", "2026-08-01", "2026-08-10"), "2026-08-05")
  assert.deepEqual(
    buildLmsWorkEntryWhere({
      from: "2026-08-01",
      to: "2026-08-10",
      clientId: " client-1 ",
      taskId: " task-2 ",
    }),
    {
      workDate: { gte: "2026-08-01", lte: "2026-08-10" },
      lmsAllocationId: "client-1",
      taskTypeId: "task-2",
    }
  )
  assert.deepEqual(
    buildLmsWorkEntryWhere({
      from: "2026-08-01",
      to: "2026-08-10",
      workDate: "2026-08-05",
      exportStatus: "not-exported",
    }),
    { workDate: "2026-08-05", exportedAt: null }
  )
  assert.deepEqual(
    buildLmsWorkEntryWhere({ from: "2026-08-01", to: "2026-08-10", workDate: "2026-08-11" }),
    { workDate: { gte: "2026-08-01", lte: "2026-08-10" } }
  )
  assert.deepEqual(buildLmsWorkEntryWhere({ from: null, to: null, clientId: "", taskId: null }), {})
  assert.deepEqual(
    buildLmsWorkEntryWhere({ from: null, to: null, exportStatus: "not-exported" }),
    { exportedAt: null }
  )
  assert.deepEqual(
    buildLmsWorkEntryWhere({ from: null, to: null, exportStatus: "exported" }),
    { exportedAt: { not: null } }
  )
  assert.deepEqual(buildLmsWorkEntryWhere({ from: null, to: null, exportStatus: "all" }), {})

  const importedClients = Array.from({ length: 850 }, (_, index) => `client-${String(index + 1).padStart(3, "0")}.ro`)
  importedClients.push("Școala Exemplu.ro")
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "CLIENT-800")).length, 1)
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "școala")).length, 1)
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "missing-client")).length, 0)
  assert.equal(buildLmsAllocationSyncKey("example.ro"), "client:example ro")
  assert.equal(buildLmsAllocationSyncKey(" Școala-Exemplu.ro "), "client:scoala exemplu ro")
  assert.equal(buildLmsAllocationSyncKey("..."), null)
  assert.deepEqual(Array.from(LMS_WORK_DURATION_PRESETS), [30, 60, 120, 180, 240])
  assert.deepEqual(Array.from(LMS_WORK_DURATION_FALLBACK_SHORTCUTS), [30, 60, 120, 180, 240, 360])
  assert.equal(parseCustomLmsWorkDuration("1"), 1)
  assert.equal(parseCustomLmsWorkDuration("1440"), 1440)
  assert.equal(parseCustomLmsWorkDuration(""), null)
  assert.equal(parseCustomLmsWorkDuration("0"), null)
  assert.equal(parseCustomLmsWorkDuration("30.5"), null)
  assert.equal(parseCustomLmsWorkDuration("1441"), null)
  assert.equal(formatCompactLmsWorkDuration(0), "—")
  assert.equal(formatCompactLmsWorkDuration(30), "30m")
  assert.equal(formatCompactLmsWorkDuration(420), "7h")
  assert.equal(formatCompactLmsWorkDuration(390), "6h30")
  assert.deepEqual(getLmsWorkDefaultDurationSelection(60), {
    durationSelection: "60",
    customMinutes: "",
  })
  assert.deepEqual(getLmsWorkDefaultDurationSelection(75), {
    durationSelection: "custom",
    customMinutes: "75",
  })
  assert.deepEqual(getLmsWorkDefaultDurationSelection(null), {
    durationSelection: "",
    customMinutes: "",
  })
  assert.deepEqual(getLmsWorkDefaultDurationSelection(0), {
    durationSelection: "",
    customMinutes: "",
  })
  assert.equal(getLmsWorkUtilizationPercent(135, 120), 2)
  assert.equal(getLmsWorkUtilizationPercent(720, 120), 10)
  assert.equal(getLmsWorkUtilizationPercent(9000, 120), 125)
  assert.equal(getLmsWorkUtilizationPercent(60, 0), 0)
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
  assert.deepEqual(
    mergeLmsWorkOptionShortcuts(
      [{ id: "task-client", label: "Client task" }, { id: "task-shared", label: "Shared" }],
      [{ id: "task-shared", label: "Shared" }, { id: "task-global", label: "Global task" }]
    ).map((option) => option.id),
    ["task-client", "task-shared", "task-global"]
  )
  assert.equal(canonicalizeLmsWorkTaskName("Meeting / videocall client"), "Meeting / videocall client ")
  assert.equal(canonicalizeLmsWorkTaskName("Meeting / videocall client "), "Meeting / videocall client ")
  assert.equal(canonicalizeLmsWorkTaskName("Custom task  "), "Custom task")
  assert.equal(LMS_WORK_TASK_NAMES_WITH_TRAILING_SPACE.length, 5)
  assert.equal(LMS_RECURRENCE_SOURCE_PREFIX, "recurrence:")
  assert.equal(weekdaysToMask([1, 2, 3, 4, 5]), 31)
  assert.equal(weekdaysToMask([2, 4]), 10)
  assert.equal(LMS_STANDARD_WORK_WEEK_MINUTES, 2400)
  assert.equal(getLmsRecurrenceWeeklyMinutes(60, [1, 2, 3, 4, 5]), 300)
  assert.equal(getLmsRecurrenceWeeklyMinutes(90, [1, 3, 3, 5]), 270)
  assert.deepEqual(maskToWeekdays(10), [2, 4])
  assert.equal(recurrenceRunsOnDate(10, "2026-07-21"), true)
  assert.equal(recurrenceRunsOnDate(10, "2026-07-22"), false)
  assert.equal(formatRecurrenceSchedule([1, 2, 3, 4, 5]), "Monday–Friday")

  const workLogSource = readFileSync(resolve(process.cwd(), "components/lms-work-entries/lms-work-log-workspace.tsx"), "utf8")
  const workLogPageSource = readFileSync(resolve(process.cwd(), "app/(dashboard)/lms-analysis/work-log/page.tsx"), "utf8")
  const workLogDbSource = readFileSync(resolve(process.cwd(), "lib/lms-work-entries/db.ts"), "utf8")
  const workTaskCatalogSource = readFileSync(resolve(process.cwd(), "components/lms-work-entries/lms-work-task-catalog.tsx"), "utf8")
  const workEntryActionsSource = readFileSync(resolve(process.cwd(), "lib/actions/lms-work-entries.ts"), "utf8")
  const workEntryExportRouteSource = readFileSync(resolve(process.cwd(), "app/api/lms-work-entries/export/route.ts"), "utf8")
  const dailyAdminAutomationSource = readFileSync(resolve(process.cwd(), "lib/lms-work-entries/daily-admin-automation.ts"), "utf8")
  const dailyAdminCronRouteSource = readFileSync(resolve(process.cwd(), "app/api/cron/lms-daily-admin-work/route.ts"), "utf8")
  const recurringWorkSource = readFileSync(resolve(process.cwd(), "components/lms-work-entries/lms-work-recurrences.tsx"), "utf8")
  const proxySource = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8")
  const prismaSchemaSource = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8")
  const taskOrderMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721180000_add_lms_work_task_order_and_defaults/migration.sql"),
    "utf8"
  )
  const exactTaskNamesMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721183000_preserve_exact_lms_task_names/migration.sql"),
    "utf8"
  )
  const employeeNameMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721190000_set_lms_crm_employee_name/migration.sql"),
    "utf8"
  )
  const exportTrackingMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721200000_track_lms_work_entry_exports/migration.sql"),
    "utf8"
  )
  const dailyAdminMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260721210000_add_lms_daily_admin_automation/migration.sql"),
    "utf8"
  )
  const dailyAdminSingletonMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260722090000_make_lms_daily_admin_singleton/migration.sql"),
    "utf8"
  )
  const recurringWorkMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260722110000_add_lms_work_recurrences/migration.sql"),
    "utf8"
  )
  const defaultTaskDurationMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260810110000_add_lms_work_task_default_duration/migration.sql"),
    "utf8"
  )
  const singleOwnerMigrationSource = readFileSync(
    resolve(process.cwd(), "prisma/migrations/20260722130000_simplify_to_single_owner/migration.sql"),
    "utf8"
  )
  const dailyAdminRunbookSource = readFileSync(resolve(process.cwd(), "docs/lms-daily-admin-cron.md"), "utf8")
  const envExampleSource = readFileSync(resolve(process.cwd(), ".env.example"), "utf8")
  const dataWorkspaceSource = readFileSync(resolve(process.cwd(), "components/lms-tasks/lms-analysis-data-workspace.tsx"), "utf8")
  assert.doesNotMatch(workLogSource, /Manage tasks|Manage predefined tasks/)
  assert.doesNotMatch(workLogSource, /Capture client work quickly/)
  assert.doesNotMatch(workLogSource, /localStorage|LMS_WORK_DURATION_STORAGE_KEY/)
  assert.doesNotMatch(workLogSource, /_120px_150px/)
  assert.match(workLogSource, /\/lms-analysis\/data#task-catalog/)
  assert.match(workLogSource, /LMS_WORK_DURATION_PRESETS\.map/)
  assert.match(workLogSource, /getLmsWorkDefaultDurationSelection\(task\?\.defaultDurationMinutes\)/)
  assert.match(workLogSource, /onValueChange=\{selectTask\}/)
  assert.doesNotMatch(workLogSource, /DEFAULT_LMS_WORK_DURATION_MINUTES/)
  assert.match(workLogSource, /const \[durationSelection, setDurationSelection\] = React\.useState\(""\)/)
  assert.match(workLogSource, /setDurationSelection\(""\)/)
  assert.doesNotMatch(workLogSource, /Select the time spent to continue\./)
  assert.doesNotMatch(workLogSource, /Enter custom minutes to continue\./)
  assert.match(workLogSource, /xl:grid-cols-\[minmax\(0,29fr\)_minmax\(360px,21fr\)\]/)
  assert.match(workLogSource, /<WorkWeekNavigator/)
  assert.match(workLogSource, /grid grid-cols-5 gap-1\.5/)
  assert.match(workLogSource, /aria-current=\{isSelected \? "date" : undefined\}/)
  assert.match(workLogSource, /addLmsWorkdays\(date, -1\)/)
  assert.match(workLogSource, /addLmsWorkdays\(date, 1\)/)
  assert.match(workLogSource, /event\.metaKey \|\| event\.ctrlKey/)
  assert.match(workLogSource, /setTaskTypeId\(""\)/)
  assert.match(workLogSource, /taskTriggerRef\.current\?\.focus\(\)/)
  assert.doesNotMatch(workLogSource, /setWorkDate\(today\)|setLmsAllocationId\(""\)|Other date/)
  assert.match(workLogSource, /hasSelection/)
  assert.equal(workLogSource.match(/<Command shouldFilter=\{false\}>/g)?.length, 3)
  assert.match(workLogSource, /CommandInput[\s\S]*placeholder="Search clients\.\.\."/)
  assert.match(workLogSource, /CommandInput[\s\S]*placeholder="Search tasks\.\.\."/)
  assert.equal(workLogSource.match(/role="combobox"/g)?.length, 3)
  assert.match(workLogSource, /Saving…/)
  assert.equal(workLogSource.match(/<WorkDatePicker/g)?.length, 1)
  assert.match(workLogSource, /id="edit-work-date"/)
  assert.match(workLogSource, /ariaLabel="Edit work date"/)
  assert.doesNotMatch(workLogSource, /id="edit-work-date" type="date"/)
  assert.match(workLogSource, /w-\[min\(92vw,420px\)\]/)
  assert.match(workLogSource, /--cell-size:clamp\(40px,11vw,48px\)/)
  assert.match(workLogSource, /disabled=\{isWeekend\}/)
  assert.match(workLogSource, /if \(!date \|\| isWeekend\(date\)\) return/)
  assert.match(workLogSource, /format\(selectedDate, "EEEE"\)/)
  assert.match(workLogSource, /Monday–Friday/)
  assert.match(workLogSource, />\s*Today\s*<\/Button>/)
  assert.match(workLogSource, /Already logged:/)
  assert.match(workLogSource, /Save \$\{durationMinutes} min ·/)
  assert.match(workLogSource, /composerContext\.frequentTasks/)
  assert.match(workLogSource, /composerRequestRef/)
  assert.match(workLogPageSource, /getLmsWorkComposerContextData/)
  assert.match(workLogDbSource, /where: \{ workDate: \{ gte: weekStart, lte: weekEnd \} \}/)
  assert.match(workLogDbSource, /mergeLmsWorkOptionShortcuts/)
  assert.match(workEntryActionsSource, /getLmsWorkComposerContext/)
  assert.match(workLogSource, /workCapacity\.hours}h · \$\{workUtilizationPercent}%/)
  assert.match(workLogSource, /workUtilizationPercent}%/)
  assert.match(workLogSource, /ExportStatusBadge/)
  assert.match(workLogSource, /Not exported/)
  assert.match(workLogSource, /Exported/)
  assert.match(workLogSource, /data\.unexportedEntries/)
  assert.match(workLogSource, /id="export-all-entries"/)
  assert.match(workLogSource, /includeExported/)
  assert.match(workLogSource, /Export all/)
  assert.match(workLogSource, /const \[selectedEntryIds, setSelectedEntryIds\] = React\.useState<string\[]>\(\[\]\)/)
  assert.match(workLogSource, /const \[exportingSelected, setExportingSelected\] = React\.useState\(false\)/)
  assert.match(workLogSource, /toggleEntrySelection/)
  assert.match(workLogSource, /toggleVisibleEntries/)
  assert.match(workLogSource, /someVisibleEntriesSelected \? "indeterminate" : false/)
  assert.match(workLogSource, /Select all \$\{data\.entries\.length\} visible work entries/)
  assert.match(workLogSource, /Select all \{data\.entries\.length\} visible rows/)
  assert.match(workLogSource, /Export selected/)
  assert.match(workLogSource, /method: "POST"/)
  assert.match(workLogSource, /body: JSON\.stringify\(\{ ids: selectedEntryIds \}\)/)
  assert.match(workLogSource, /downloadExportResponse\(response, selectedEntryIds\.length\)/)
  assert.match(workLogSource, /const visibleIds = new Set\(data\.entries\.map/)
  assert.match(workLogSource, /colSpan=\{7\}/)
  assert.doesNotMatch(workLogSource, /Romanian workdays × 8h/)
  assert.match(workLogSource, /Frequently used/)
  assert.match(workLogSource, /Frequently used clients/)
  assert.match(workLogSource, /Frequently used tasks/)
  assert.match(workLogSource, /toLocaleLowerCase\("ro"\) === "\[intern\]"/)
  assert.match(workLogSource, /client\.id !== internalClient\?\.id/)
  assert.match(workLogSource, /grid grid-cols-3 gap-2/)
  assert.match(workLogSource, /triggerRef=\{taskTriggerRef\}/)
  assert.match(workLogSource, /flex h-full flex-col gap-4/)
  assert.match(workLogSource, /clients\.filter\(\(client\) => matchesLmsClientSearch\(client\.client, search\)\)/)
  assert.match(workLogSource, /options\.filter\(\(task\) => matchesLmsClientSearch\(task\.name, search\)\)/)
  assert.equal(workLogSource.match(/setSearch\(""\)/g)?.length, 3)
  assert.match(workLogSource, /Save \$\{durationMinutes} min/)
  assert.match(workLogSource, /!hasSelectedClient/)
  assert.match(workLogSource, /!hasSelectedTask/)
  assert.match(workLogSource, /Add client/)
  assert.match(workLogSource, /createLmsWorkClient/)
  assert.match(workLogSource, /Use or add/)
  assert.match(workLogSource, /onCreateRequest/)
  assert.match(workLogSource, /If it already exists, it will be selected instead of duplicated\./)
  assert.match(workLogSource, /setLmsAllocationId\(client\.id\)/)
  assert.match(workLogSource, /Days logged/)
  assert.match(workLogSource, /data\.workedDays/)
  assert.doesNotMatch(workLogSource, /First task date:|Last task date:/)
  assert.match(workLogSource, /formatEntryDateSpan\(data\.firstWorkDate, data\.lastWorkDate\)/)
  assert.match(workLogSource, /sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap/)
  assert.match(workLogSource, /const periodDisplayLabel = `\$\{selectedPeriodName\} \(\$\{matchingTaskDateSpan\}\)`/)
  assert.match(workLogSource, /: "no tasks"/)
  assert.match(workLogSource, /aria-label=\{`Date range: \$\{periodDisplayLabel\}`\}/)
  assert.match(workLogSource, /<SelectValue>\{periodDisplayLabel\}<\/SelectValue>/)
  assert.match(workLogSource, /className="w-full sm:w-\[360px\]"/)
  assert.doesNotMatch(workLogSource, /First and last matching task dates/)
  assert.doesNotMatch(workLogSource, />\s*Date range\s*</)
  assert.match(workLogSource, /flex w-full min-w-0 flex-wrap items-center gap-2/)
  assert.doesNotMatch(workLogSource, /type="date"/)
  assert.doesNotMatch(workLogSource, /range-from|range-to/)
  assert.match(workLogSource, /function WorkEntryCustomRangePicker/)
  assert.match(workLogSource, /mode="range"/)
  assert.match(workLogSource, /numberOfMonths=\{calendarMonths\}/)
  assert.match(workLogSource, /window\.matchMedia\("\(min-width: 768px\)"\)/)
  assert.match(workLogSource, /Choose a start date and an end date\./)
  assert.match(workLogSource, /Last 7 days/)
  assert.match(workLogSource, /This month/)
  assert.match(workLogSource, /Apply range/)
  assert.match(workLogSource, /disabled=\{!from \|\| !to\}/)
  assert.match(workLogSource, /requestAnimationFrame\(\(\) => setCustomRangeOpen\(true\)\)/)
  assert.match(workLogSource, /setPeriod\(activePeriod\)/)
  assert.match(workLogSource, /next\.delete\("date"\)/)
  assert.match(workLogSource, /Filter work entries by date/)
  assert.match(workLogSource, /triggerLabel="Date"/)
  assert.match(workLogSource, /options=\{data\.dateFilterOptions\.map/)
  assert.match(workLogSource, /All dates/)
  assert.match(workLogSource, /Filter work entries by client/)
  assert.match(workLogSource, /Filter work entries by task/)
  assert.match(workLogSource, /triggerLabel="Client"/)
  assert.match(workLogSource, /triggerLabel="Task"/)
  assert.match(workLogSource, /options=\{data\.clientFilterOptions\}/)
  assert.match(workLogSource, /options=\{data\.taskFilterOptions\}/)
  assert.doesNotMatch(workLogSource, /options=\{clientOptions\.map/)
  assert.match(workLogSource, /All clients/)
  assert.match(workLogSource, /All tasks/)
  assert.match(workLogSource, /Rows per page/)
  assert.match(workLogSource, /LMS_WORK_LOG_PAGE_SIZES\.map/)
  assert.match(workLogSource, /query\.set\("client", data\.clientId\)/)
  assert.match(workLogSource, /query\.set\("task", data\.taskId\)/)
  assert.match(workLogSource, /query\.set\("date", data\.workDate\)/)
  assert.match(workLogSource, /query\.set\("exportStatus", data\.exportStatus\)/)
  assert.match(workLogSource, /Filter work entries by CRM export status/)
  assert.match(workLogSource, /triggerLabel="CRM export"/)
  assert.match(workLogSource, /allValue="all"/)
  assert.match(workLogSource, /options=\{EXPORT_STATUS_FILTER_OPTIONS\}/)
  assert.match(workLogSource, /value=\{data\.exportStatus\}/)
  assert.match(workLogSource, /data\.allMatchingEntries/)
  assert.match(workLogSource, /sm:grid-cols-2 md:hidden/)
  assert.match(workLogPageSource, /normalizeLmsWorkLogPageSize\(params\.pageSize\)/)
  assert.match(workLogPageSource, /resolveLmsDatePreset\(params\.period \|\| "all"\)/)
  assert.match(workLogPageSource, /normalizeLmsWorkExportStatus\(params\.exportStatus\)/)
  assert.match(workLogPageSource, /normalizeLmsWorkDateFilter\(params\.date, from, to\)/)
  assert.match(workLogPageSource, /clientId: params\.client/)
  assert.match(workLogPageSource, /taskId: params\.task/)
  assert.match(workLogDbSource, /prisma\.lmsWorkEntry\.groupBy/)
  assert.match(workLogDbSource, /by: \["workDate"\]/)
  assert.match(workLogDbSource, /workedDays: workedDates\.length/)
  assert.match(workLogDbSource, /firstWorkDate: aggregate\._min\.workDate/)
  assert.match(workLogDbSource, /lastWorkDate: aggregate\._max\.workDate/)
  assert.match(workLogDbSource, /normalizeLmsWorkDateFilter\(args\?\.workDate, from, to\)/)
  assert.match(workLogDbSource, /buildLmsWorkEntryWhere\(\{ from, to, workDate, clientId, taskId \}\)/)
  assert.match(workLogDbSource, /normalizeLmsWorkExportStatus\(args\?\.exportStatus\)/)
  assert.match(workLogDbSource, /buildLmsWorkEntryWhere\(\{ from, to, workDate, clientId, taskId, exportStatus \}\)/)
  assert.match(workLogDbSource, /buildLmsWorkEntryWhere\(\{ from, to, clientId, taskId, exportStatus \}\)/)
  assert.match(workLogDbSource, /buildLmsWorkEntryWhere\(\{ from, to, workDate, taskId, exportStatus \}\)/)
  assert.match(workLogDbSource, /buildLmsWorkEntryWhere\(\{ from, to, workDate, clientId, exportStatus \}\)/)
  assert.match(workLogDbSource, /dateFilterOptions: dateFilterRows\.map/)
  assert.match(workLogDbSource, /allMatchingEntries/)
  assert.match(workLogDbSource, /by: \["lmsAllocationId", "clientDomainSnapshot"\]/)
  assert.match(workLogDbSource, /by: \["taskTypeId", "taskNameSnapshot"\]/)
  assert.match(workLogDbSource, /clientFilterOptions/)
  assert.match(workLogDbSource, /taskFilterOptions/)
  assert.match(workLogDbSource, /by: \["lmsAllocationId"\]/)
  assert.match(workLogDbSource, /by: \["taskTypeId"\]/)
  assert.doesNotMatch(workLogDbSource, /tenantId|userId|requireTenantContext/)
  assert.match(workLogDbSource, /orderBy: \[\{ sortOrder: "asc" \}, \{ name: "asc" \}\]/)
  assert.match(workLogDbSource, /defaultDurationMinutes: true/)
  assert.match(workLogDbSource, /exportedAt: null/)
  assert.match(workLogDbSource, /exportedAt: true/)
  assert.match(workTaskCatalogSource, /draggable=\{canReorder\}/)
  assert.match(workTaskCatalogSource, /reorderLmsWorkTasks/)
  assert.match(workTaskCatalogSource, /Default time \(min\)/)
  assert.match(workTaskCatalogSource, /task\.defaultDurationMinutes/)
  assert.match(workTaskCatalogSource, /No default/)
  assert.match(workTaskCatalogSource, /createLmsWorkTask\(\{ name: newTask, defaultDurationMinutes \}\)/)
  assert.match(workTaskCatalogSource, /Alt\+ArrowUp Alt\+ArrowDown/)
  assert.match(workEntryActionsSource, /export async function reorderLmsWorkTasks/)
  assert.match(workEntryActionsSource, /export async function createLmsWorkClient/)
  assert.match(workEntryActionsSource, /DefaultDurationMinutesSchema/)
  assert.match(workEntryActionsSource, /defaultDurationMinutes: validated\.defaultDurationMinutes/)
  assert.match(workEntryActionsSource, /buildLmsAllocationSyncKey/)
  assert.match(workEntryActionsSource, /specialist: LMS_CRM_EMPLOYEE_NAME/)
  assert.match(workEntryActionsSource, /concurrentlyCreated/)
  assert.match(workEntryActionsSource, /LMS_WORK_CLIENT_CREATED/)
  assert.match(workEntryActionsSource, /where: \{ id \}/)
  assert.doesNotMatch(workEntryActionsSource, /tenantId|userId|requireTenantContext/)
  assert.match(workEntryActionsSource, /employeeNameSnapshot: LMS_CRM_EMPLOYEE_NAME/)
  assert.match(workEntryActionsSource, /exportedAt: null/)
  assert.match(workEntryExportRouteSource, /exportedAt: null/)
  assert.match(workEntryExportRouteSource, /includeExported.*=== "true"/)
  assert.match(workEntryExportRouteSource, /buildLmsWorkEntryWhere\(\{ from, to, workDate, clientId, taskId \}\)/)
  assert.match(workEntryExportRouteSource, /searchParams\.get\("date"\)/)
  assert.match(workEntryExportRouteSource, /normalizeLmsWorkDateFilter/)
  assert.match(workEntryExportRouteSource, /searchParams\.get\("client"\)/)
  assert.match(workEntryExportRouteSource, /searchParams\.get\("task"\)/)
  assert.match(workEntryExportRouteSource, /searchParams\.get\("exportStatus"\)/)
  assert.match(workEntryExportRouteSource, /normalizeLmsWorkExportStatus/)
  assert.match(workEntryExportRouteSource, /exportStatus === "exported" \? \{ exportedAt: \{ not: null \} \} : \{\}/)
  assert.match(workEntryExportRouteSource, /: \{ exportedAt: null \}/)
  assert.match(workEntryExportRouteSource, /data: \{ exportedAt \}/)
  assert.match(workEntryExportRouteSource, /LMS_WORK_EXPORT_CONFLICT/)
  assert.match(workEntryExportRouteSource, /const SelectedExportSchema/)
  assert.match(workEntryExportRouteSource, /\.min\(1\)\.max\(250\)/)
  assert.match(workEntryExportRouteSource, /export async function POST\(request: NextRequest\)/)
  assert.match(workEntryExportRouteSource, /const ids = Array\.from\(new Set\(parsed\.data\.ids\)\)/)
  assert.match(workEntryExportRouteSource, /where: \{ id: \{ in: ids \} \}/)
  assert.match(workEntryExportRouteSource, /requireUnexported: false/)
  assert.match(workEntryExportRouteSource, /expectedCount: ids\.length/)
  assert.match(workEntryExportRouteSource, /LMS_WORK_SELECTION_STALE/)
  assert.match(workEntryExportRouteSource, /TASK_IMPORT_SELECTED_/)
  assert.match(workEntryExportRouteSource, /auditDetails: "mode=selected"/)
  assert.match(workEntryExportRouteSource, /X-Exported-Entry-Count/)
  assert.match(prismaSchemaSource, /sortOrder\s+Int\s+@default\(1000\)\s+@map\("sort_order"\)/)
  assert.match(prismaSchemaSource, /defaultDurationMinutes\s+Int\?\s+@map\("default_duration_minutes"\)/)
  assert.match(defaultTaskDurationMigrationSource, /ADD COLUMN "default_duration_minutes" INTEGER/)
  assert.match(prismaSchemaSource, /exportedAt\s+DateTime\?\s+@map\("exported_at"\)/)
  assert.match(prismaSchemaSource, /sourceKey\s+String\?\s+@map\("source_key"\)/)
  assert.match(prismaSchemaSource, /model LmsWorkRecurrence/)
  assert.doesNotMatch(prismaSchemaSource, /model LmsWorkAutomationState/)
  assert.match(prismaSchemaSource, /@@unique\(\[sourceKey, workDate\]\)/)
  assert.doesNotMatch(prismaSchemaSource, /model Tenant/)
  assert.match(taskOrderMigrationSource, /INSERT OR IGNORE INTO "lms_work_tasks"/)
  assert.match(exactTaskNamesMigrationSource, /UPDATE "lms_work_tasks"/)
  assert.match(exactTaskNamesMigrationSource, /UPDATE "lms_work_entries"/)
  assert.match(employeeNameMigrationSource, /"employee_name_snapshot" = 'Marius Ciurariu'/)
  assert.match(exportTrackingMigrationSource, /ADD COLUMN "exported_at" DATETIME/)
  assert.match(exportTrackingMigrationSource, /CREATE INDEX "lms_work_entries_tenant_id_user_id_exported_at_work_date_idx"/)
  assert.match(dailyAdminMigrationSource, /ADD COLUMN "source_key" TEXT/)
  assert.match(dailyAdminMigrationSource, /CREATE TABLE "lms_work_automation_states"/)
  assert.match(dailyAdminMigrationSource, /lms_work_entries_tenant_id_user_id_source_key_work_date_key/)
  assert.match(dailyAdminSingletonMigrationSource, /lms_work_entries_tenant_id_source_key_work_date_key/)
  assert.match(dailyAdminSingletonMigrationSource, /new_lms_work_automation_states/)
  assert.doesNotMatch(dailyAdminSingletonMigrationSource, /"user_id" TEXT NOT NULL/)
  assert.match(recurringWorkMigrationSource, /Meeting \/ videocall intern /)
  assert.match(recurringWorkMigrationSource, /Task-uri administrative/)
  assert.match(recurringWorkMigrationSource, /Comunicare client \/ coleg - email \/ telefon/)
  assert.match(recurringWorkMigrationSource, /Dezvoltare/)
  assert.match(recurringWorkMigrationSource, /UPDATE "lms_work_entries"/)
  assert.match(recurringWorkMigrationSource, /DROP TABLE "lms_work_automation_states"/)
  assert.match(singleOwnerMigrationSource, /CREATE TEMP TABLE "_single_owner_guard"/)
  assert.match(singleOwnerMigrationSource, /DROP TABLE "tenants"/)
  assert.match(singleOwnerMigrationSource, /PRAGMA foreign_key_check/)
  assert.match(dailyAdminAutomationSource, /LMS_RECURRENCE_SOURCE_PREFIX/)
  assert.match(dailyAdminAutomationSource, /sourceKey: null/)
  assert.match(dailyAdminAutomationSource, /durationMinutes: rule\.durationMinutes/)
  assert.match(dailyAdminAutomationSource, /employeeNameSnapshot: LMS_CRM_EMPLOYEE_NAME/)
  assert.match(dailyAdminAutomationSource, /processedThrough: today/)
  assert.match(dailyAdminAutomationSource, /isRomanianLegalHoliday/)
  assert.match(dailyAdminAutomationSource, /prisma\.\$transaction/)
  assert.doesNotMatch(dailyAdminAutomationSource, /LMS_DAILY_ADMIN_OWNER_USERNAME|prisma\.user|tenantId|userId/)
  assert.doesNotMatch(dailyAdminAutomationSource, /process\.env\.LMS_DAILY_ADMIN_USERNAME/)
  assert.match(dailyAdminCronRouteSource, /matchesBearerOrHeaderSecret/)
  assert.match(dailyAdminCronRouteSource, /CRON_UNAUTHORIZED/)
  assert.match(dailyAdminCronRouteSource, /dryRun.*=== "1"/)
  assert.match(dailyAdminCronRouteSource, /LMS_RECURRING_WORK_COMPLETED/)
  assert.match(dailyAdminCronRouteSource, /LMS_DAILY_ADMIN_WORK_FAILED/)
  assert.doesNotMatch(dailyAdminCronRouteSource, /username: target\.username/)
  assert.match(proxySource, /\/api\/cron\/lms-daily-admin-work/)
  assert.match(dailyAdminRunbookSource, /CRON_TZ=Europe\/Bucharest/)
  assert.match(dailyAdminRunbookSource, /5 8 \* \* \*/)
  assert.doesNotMatch(envExampleSource, /LMS_DAILY_ADMIN_USERNAME/)
  assert.equal(LMS_CRM_EMPLOYEE_NAME, "Marius Ciurariu")
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
  assert.match(dataWorkspaceSource, /id="recurring-work"/)
  assert.match(dataWorkspaceSource, /id="imports"/)
  assert.match(dataWorkspaceSource, /id="import-logs"/)
  assert.match(recurringWorkSource, /ClientCombobox/)
  assert.match(recurringWorkSource, /AddClientDialog/)
  assert.match(recurringWorkSource, /onCreateRequest=\{openAddClient\}/)
  assert.match(recurringWorkSource, /lmsAllocationId: client\.id/)
  assert.match(recurringWorkSource, /TaskCombobox/)
  assert.match(recurringWorkSource, /LMS_RECURRENCE_WEEKDAYS/)
  assert.match(recurringWorkSource, /setLmsWorkRecurrenceActive/)
  assert.match(workLogDbSource, /where: \{ isActive: true \}/)
  assert.match(recurringWorkSource, /activeRecurrences/)
  assert.match(recurringWorkSource, /Recurring work \/ week/)
  assert.match(recurringWorkSource, /Standard work week/)
  assert.match(recurringWorkSource, /Weekly recurring load/)
  assert.match(recurringWorkSource, /weeklyRecurringMinutes/)
  assert.match(recurringWorkSource, /\/ run/)
  assert.match(recurringWorkSource, /\/ week/)
  assert.doesNotMatch(recurringWorkSource, /deleteLmsWorkRecurrence/)

  const buffer = await buildLmsCrmExportBuffer([
    {
      workDate: "2026-03-12",
      clientDomainSnapshot: "example.ro",
      taskNameSnapshot: "Meeting / videocall client ",
      employeeNameSnapshot: "Marius",
      durationMinutes: 60,
    },
    {
      workDate: "2026-03-13",
      clientDomainSnapshot: "[Intern]",
      taskNameSnapshot: "Comunicare client / coleg - email / telefon",
      employeeNameSnapshot: "mxa95",
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
