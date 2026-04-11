import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function read(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), "utf8")
}

function run() {
  const responsive = read("lib/ui/responsive.ts")
  assert.match(responsive, /tabletPortraitMin:\s*768/)
  assert.match(responsive, /tabletPortraitMax:\s*1023/)
  assert.match(responsive, /tabletLandscapeMin:\s*1024/)
  assert.match(responsive, /tabletLandscapeMax:\s*1279/)
  assert.match(responsive, /desktopMin:\s*1280/)

  const headerCss = read("app/globals.css")
  assert.match(headerCss, /header-action-label[\s\S]*hidden xl:inline/)

  const filterPrimitive = read("components/ui/filter-bar.tsx")
  assert.match(filterPrimitive, /inline-flex min-w-max items-center gap-4 xl:flex xl:w-full xl:min-w-0/)
  assert.match(filterPrimitive, /flex w-full min-w-0 flex-wrap items-center gap-3 xl:gap-6/)

  const dashboardHeader = read("components/layout/dashboard-page-header.tsx")
  assert.match(dashboardHeader, /md:grid md:grid-cols-\[minmax\(180px,auto\)_minmax\(0,1fr\)_auto\] xl:hidden/)
  assert.match(dashboardHeader, /hidden gap-4 xl:flex xl:items-center/)

  const projectsToolbar = read("components/projects/projects-filters-toolbar.tsx")
  assert.match(projectsToolbar, /overscroll-x-contain xl:overflow-visible xl:px-0/)

  const tasksToolbar = read("components/tasks/tasks-toolbar.tsx")
  assert.match(tasksToolbar, /overscroll-x-contain xl:overflow-visible xl:px-0/)

  const projectsRows = read("components/projects/projects-board-rows.tsx")
  assert.match(projectsRows, /md:min-w-\[1240px\] xl:min-w-\[1320px\]/)

  const paymentsTable = read("components/payments/payments-table.tsx")
  assert.match(paymentsTable, /md:min-w-\[940px\] xl:min-w-\[1200px\]/)

  const timeTable = read("components/time/time-logs-table.tsx")
  assert.match(timeTable, /md:min-w-\[960px\] xl:min-w-\[1240px\]/)
  assert.match(timeTable, /xl:opacity-0 xl:group-hover:opacity-100/)

  const domainsTable = read("components/vault/sites-table.tsx")
  assert.match(domainsTable, /md:min-w-\[940px\] xl:min-w-\[1240px\]/)

  const notesWorkspace = read("components/notes/notes-workspace.tsx")
  assert.match(notesWorkspace, /lg:grid-cols-\[300px_minmax\(0,1fr\)\]/)
  assert.match(notesWorkspace, /sm:px-3\.5 sm:py-2\.5 lg:hidden/)

  process.stdout.write("verify-tablet-guardrails: ok\n")
}

run()
