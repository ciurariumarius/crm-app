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

  const appPageHeader = read("components/layout/app-page-header.tsx")
  assert.match(appPageHeader, /md:grid md:grid-cols-\[minmax\(180px,1fr\)_minmax\(280px,640px\)_minmax\(160px,1fr\)\]/)
  assert.match(appPageHeader, /xl:grid-cols-\[minmax\(240px,1fr\)_minmax\(360px,640px\)_minmax\(240px,1fr\)\]/)
  assert.match(appPageHeader, /controls\?: React\.ReactNode/)
  assert.match(appPageHeader, /xl:grid-cols-\[auto_minmax\(240px,320px\)_1fr_auto_auto\]/)

  const projectsToolbar = read("components/projects/projects-filters-toolbar.tsx")
  assert.match(projectsToolbar, /overscroll-x-contain xl:overflow-visible xl:px-0/)

  const tasksToolbar = read("components/tasks/tasks-toolbar.tsx")
  assert.match(tasksToolbar, /<div className="hidden md:block">/)
  assert.match(tasksToolbar, /<div className="md:hidden">/)
  assert.match(tasksToolbar, /PopoverContent align="end" sideOffset=\{8\} className="w-\[540px\]/)
  assert.match(tasksToolbar, /SheetContent side="bottom"/)
  assert.doesNotMatch(tasksToolbar, /Grid columns|currentCols/)

  const projectsRows = read("components/projects/projects-board-rows.tsx")
  assert.match(projectsRows, /md:min-w-\[1240px\] xl:min-w-\[1320px\]/)
  assert.match(projectsRows, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/)

  const projectsHeader = read("components/projects/projects-header-controls.tsx")
  assert.match(projectsHeader, /PopoverContent align="end" sideOffset=\{8\} className="w-\[540px\]/)

  const paymentsTable = read("components/payments/payments-table.tsx")
  assert.match(paymentsTable, /md:min-w-\[1040px\] xl:min-w-\[1200px\]/)

  const timeTable = read("components/time/time-logs-table.tsx")
  assert.match(timeTable, /md:min-w-\[960px\] xl:min-w-\[1240px\]/)
  assert.match(timeTable, /xl:opacity-0 xl:group-hover:opacity-100/)

  const domainsTable = read("components/vault/sites-table.tsx")
  assert.match(domainsTable, /md:min-w-\[940px\] xl:min-w-\[1240px\]/)


  process.stdout.write("verify-tablet-guardrails: ok\n")
}

run()
