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

  const projectsPage = read("app/(dashboard)/lms-analysis/projects/page.tsx")
  assert.match(projectsPage, /hidden md:block/)
  assert.match(projectsPage, /md:hidden/)

  const dataPage = read("app/(dashboard)/lms-analysis/data/page.tsx")
  assert.match(dataPage, /hidden md:block/)
  assert.match(dataPage, /md:hidden/)

  const dateFilter = read("components/lms-tasks/lms-tasks-date-range-filters.tsx")
  assert.match(dateFilter, /min\(96vw,640px\)/)

  process.stdout.write("verify-mobile-guardrails: ok\n")
}

run()
