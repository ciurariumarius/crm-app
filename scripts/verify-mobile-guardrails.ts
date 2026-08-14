import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), "utf8")
}

function run() {
  const shellFrame = read("components/layout/shell-frame.tsx")
  assert.match(shellFrame, /window\.scrollTo\(\{ top: 0, left: 0 \}\)/)
  assert.match(shellFrame, /<div className="min-h-dvh bg-\[var\(--bg-canvas\)\]/)
  assert.match(shellFrame, /md:min-h-\[calc\(100dvh-1rem\)\]/)
  assert.match(shellFrame, /<main className="[^"]*min-h-full[^"]*flex-1[^"]*overflow-x-clip/)
  assert.doesNotMatch(shellFrame, /app-scroll-container/)
  assert.doesNotMatch(shellFrame, /overflow-y-auto/)
  assert.doesNotMatch(shellFrame, /<main className="[^"]*overflow-hidden/)

  const sidebar = read("components/layout/sidebar.tsx")
  assert.match(sidebar, /fixed left-0 top-0[^"]*md:left-2 md:top-2[^"]*xl:left-4 xl:top-4/)

  const mobileBottomNav = read("components/layout/mobile-bottom-nav.tsx")
  assert.match(mobileBottomNav, /window\.addEventListener\("scroll", onWindowScroll/)
  assert.match(mobileBottomNav, /inline-flex h-11 w-11[\s\S]*?aria-label="Quick actions"/)
  assert.doesNotMatch(mobileBottomNav, /appScrollContainer/)

  const tablePrimitive = read("components/ui/table.tsx")
  assert.match(tablePrimitive, /md:whitespace-nowrap/)
  assert.match(tablePrimitive, /whitespace-normal/)

  const tasksPage = read("app/(dashboard)/lms-analysis/tasks/page.tsx")
  assert.match(tasksPage, /hidden md:block/)
  assert.match(tasksPage, /md:hidden/)

  const workLog = read("components/lms-work-entries/lms-work-log-workspace.tsx")
  assert.match(workLog, /hidden (?:overflow-hidden|overflow-x-auto) rounded-2xl[^\n]+md:block/)
  assert.match(workLog, /\[&_table\]:min-w-\[980px\]/)
  assert.match(workLog, /space-y-3 md:hidden/)
  assert.match(workLog, /xl:grid-cols-\[minmax\(0,29fr\)_minmax\(360px,21fr\)\]/)
  assert.match(workLog, /xl:col-span-2/)
  assert.match(workLog, /xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6/)
  assert.match(workLog, /flex gap-1.5 overflow-x-auto pb-1/)
  assert.match(workLog, /grid grid-cols-3 gap-2/)
  assert.match(workLog, /grid grid-cols-5 gap-1.5/)
  assert.match(workLog, /w-\[min\(92vw,420px\)\]/)
  assert.match(workLog, /--cell-size:clamp\(40px,11vw,48px\)/)
  assert.match(workLog, /disabled=\{isWeekend\}/)
  assert.match(workLog, /h-11! w-full rounded-xl/)
  assert.match(workLog, /w-\[min\(94vw,760px\)\]/)
  assert.match(workLog, /setCalendarMonths\(media\.matches \? 2 : 1\)/)
  assert.match(workLog, /w-full justify-between gap-2 rounded-lg[^\n]+sm:w-auto sm:min-w-56/)
  assert.match(workLog, /id="select-visible-work-entries-mobile"/)
  assert.match(workLog, /Select all \{data\.entries\.length\} visible rows/)
  assert.match(workLog, /selectedEntryIdSet\.has\(entry\.id\)/)

  const projectsPage = read("app/(dashboard)/lms-analysis/projects/page.tsx")
  assert.match(projectsPage, /hidden md:block/)
  assert.match(projectsPage, /md:hidden/)

  const dataWorkspace = read("components/lms-tasks/lms-analysis-data-workspace.tsx")
  assert.match(dataWorkspace, /hidden md:block/)
  assert.match(dataWorkspace, /md:hidden/)

  const workTaskCatalog = read("components/lms-work-entries/lms-work-task-catalog.tsx")
  assert.match(workTaskCatalog, /grid gap-2 sm:grid-cols-\[minmax\(0,1fr\)_160px_auto\] sm:items-end/)
  assert.match(workTaskCatalog, /sm:flex-row sm:items-center/)
  assert.match(workTaskCatalog, /draggable=\{canReorder\}/)
  assert.match(workTaskCatalog, /flex sm:hidden/)
  assert.match(workTaskCatalog, /Move \$\{task\.name\} up/)
  assert.match(workTaskCatalog, /Move \$\{task\.name\} down/)

  const recurringWork = read("components/lms-work-entries/lms-work-recurrences.tsx")
  assert.match(recurringWork, /grid gap-4 lg:grid-cols-2/)
  assert.match(recurringWork, /grid grid-cols-4 gap-2 sm:grid-cols-7/)
  assert.match(recurringWork, /flex flex-wrap items-start justify-between gap-3/)
  assert.match(recurringWork, /flex flex-wrap items-center justify-between gap-3/)
  assert.match(recurringWork, /grid gap-3 sm:grid-cols-2/)

  const dateFilter = read("components/lms-tasks/lms-tasks-date-range-filters.tsx")
  assert.match(dateFilter, /min\(96vw,640px\)/)

  process.stdout.write("verify-mobile-guardrails: ok\n")
}

run()
