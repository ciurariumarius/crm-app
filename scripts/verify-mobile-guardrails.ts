import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), "utf8")
}

function run() {
  const tablePrimitive = read("components/ui/table.tsx")
  assert.match(tablePrimitive, /md:whitespace-nowrap/)
  assert.match(tablePrimitive, /whitespace-normal/)

  const tasksPage = read("app/(dashboard)/lms-analysis/tasks/page.tsx")
  assert.match(tasksPage, /hidden md:block/)
  assert.match(tasksPage, /md:hidden/)

  const workLog = read("components/lms-work-entries/lms-work-log-workspace.tsx")
  assert.match(workLog, /hidden overflow-hidden rounded-2xl[^\n]+md:block/)
  assert.match(workLog, /space-y-3 md:hidden/)
  assert.match(workLog, /xl:grid-cols-\[minmax\(0,11fr\)_minmax\(420px,9fr\)\]/)
  assert.match(workLog, /xl:col-start-2 xl:row-span-2 xl:row-start-1/)
  assert.match(workLog, /xl:col-start-1 xl:row-start-2/)
  assert.match(workLog, /xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6/)
  assert.match(workLog, /grid grid-cols-3 gap-2/)
  assert.match(workLog, /h-12! w-full rounded-xl/)

  const projectsPage = read("app/(dashboard)/lms-analysis/projects/page.tsx")
  assert.match(projectsPage, /hidden md:block/)
  assert.match(projectsPage, /md:hidden/)

  const dataWorkspace = read("components/lms-tasks/lms-analysis-data-workspace.tsx")
  assert.match(dataWorkspace, /hidden md:block/)
  assert.match(dataWorkspace, /md:hidden/)

  const workTaskCatalog = read("components/lms-work-entries/lms-work-task-catalog.tsx")
  assert.match(workTaskCatalog, /flex flex-col gap-2 sm:flex-row/)
  assert.match(workTaskCatalog, /sm:flex-row sm:items-center/)

  const dateFilter = read("components/lms-tasks/lms-tasks-date-range-filters.tsx")
  assert.match(dateFilter, /min\(96vw,640px\)/)

  process.stdout.write("verify-mobile-guardrails: ok\n")
}

run()
