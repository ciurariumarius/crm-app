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
  assert.match(shellFrame, /isNotesPage \? "h-dvh overflow-hidden" : "min-h-dvh"/)
  assert.match(shellFrame, /md:min-h-\[calc\(100dvh-1rem\)\]/)
  assert.match(shellFrame, /isNotesPage[\s\S]*?"h-full min-h-0 overflow-hidden p-0"/)
  assert.match(shellFrame, /"cockpit-page-enter max-w-full flex-1 overflow-x-clip"/)
  assert.match(shellFrame, /"min-h-full px-4 pb-6 pt-4/)
  assert.doesNotMatch(shellFrame, /app-scroll-container/)
  assert.doesNotMatch(shellFrame, /overflow-y-auto/)

  const sidebar = read("components/layout/sidebar.tsx")
  assert.match(sidebar, /fixed left-0 top-0[^"]*md:left-2 md:top-2[^"]*xl:left-4 xl:top-4/)

  assert.doesNotMatch(shellFrame, /MobileBottomNav/)

  const notesWorkspace = read("components/notes/notes-workspace.tsx")
  const richTextEditor = read("components/ui/rich-text-editor.tsx")
  assert.match(notesWorkspace, /flex h-full min-h-0 w-full flex-col overflow-hidden/)
  assert.match(notesWorkspace, /md:grid-cols-\[230px_minmax\(0,1fr\)\]/)
  assert.match(notesWorkspace, /xl:grid-cols-\[180px_230px_minmax\(0,1fr\)\]/)
  assert.doesNotMatch(notesWorkspace, /calc\(5rem\+env\(safe-area-inset-bottom\)\)/)
  assert.match(richTextEditor, /hidden[^\n]+md:flex/)
  assert.match(richTextEditor, /pb-\[max\(1\.5rem,env\(safe-area-inset-bottom\)\)\]/)

  const tablePrimitive = read("components/ui/table.tsx")
  assert.match(tablePrimitive, /md:whitespace-nowrap/)
  assert.match(tablePrimitive, /whitespace-normal/)

  const tasksPage = read("app/(dashboard)/lms-analysis/tasks/page.tsx")
  assert.match(tasksPage, /hidden md:block/)
  assert.match(tasksPage, /md:hidden/)

  const crmTasksToolbar = read("components/tasks/tasks-toolbar.tsx")
  assert.match(crmTasksToolbar, /SheetContent side="bottom"/)
  assert.match(crmTasksToolbar, /hidden md:block/)
  assert.match(crmTasksToolbar, /md:hidden/)

  const crmTasksCards = read("components/tasks/tasks-card-view.tsx")
  const taskGridCard = read("components/tasks/task-grid-card.tsx")
  const taskEstimateQuickEdit = read("components/tasks/task-estimated-time-quick-edit.tsx")
  const taskActualTimeQuickEdit = read("components/tasks/task-actual-time-quick-edit.tsx")
  const taskDetails = read("components/tasks/task-details.tsx")
  assert.match(crmTasksCards, /data-slot="add-task-card"/)
  assert.match(crmTasksCards, /bg-transparent/)
  assert.match(crmTasksCards, /grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4/)
  assert.doesNotMatch(crmTasksCards, /renderQuickComposer|QUICK_CAPTURE_LMS_TARGET/)
  assert.doesNotMatch(crmTasksCards, /Time \(min\)|quickEstimatedMinutes/)
  assert.match(taskGridCard, /TaskActualTimeQuickEdit/)
  assert.doesNotMatch(taskGridCard, /Created \$\{format|createdLabel|toCreatedLabel/)
  assert.match(taskEstimateQuickEdit, /inputMode="numeric"/)
  assert.match(taskEstimateQuickEdit, /QUICK_ESTIMATES = \[15, 30, 60, 120\]/)
  assert.match(taskEstimateQuickEdit, /updateTask\(taskId, \{ estimatedMinutes: nextMinutes \}\)/)
  assert.match(taskActualTimeQuickEdit, /setTaskTimeTotal/)
  assert.match(taskActualTimeQuickEdit, /Edit total time/)
  assert.match(taskDetails, /addTaskTimeEntry/)
  assert.match(taskDetails, /TaskActualTimeQuickEdit/)
  assert.doesNotMatch(taskDetails, /LMS time is recorded on completion/)

  const createTaskDialog = read("components/tasks/global-create-task-dialog.tsx")
  assert.match(createTaskDialog, /max-h-\[min\(90dvh,760px\)\]/)
  assert.match(createTaskDialog, /create-task-form-scroll-area/)
  assert.match(createTaskDialog, /max-w-\[calc\(100vw-2rem\)\]/)
  assert.doesNotMatch(createTaskDialog, /LMS stays separate|Available for Freelance and LMS|Client work|My job/)

  const dashboardTasks = read("components/dashboard/home-task-columns.tsx")
  const dashboardActions = read("components/dashboard/home-header-actions.tsx")
  const dashboardPage = read("app/(dashboard)/page.tsx")
  assert.match(dashboardActions, /grid grid-cols-2 gap-2 md:grid-cols-4/)
  assert.match(dashboardActions, /href="\/notes\?new=1"/)
  assert.match(dashboardPage, /grid grid-cols-1 gap-2\.5 sm:grid-cols-2[^\n]+xl:grid-cols-4/)
  assert.match(dashboardTasks, /min-h-16/)
  assert.match(dashboardTasks, /Mark .* complete/)
  const projectTasks = read("components/projects/project-tasks.tsx")
  assert.doesNotMatch(dashboardTasks, /Time \(min\)|quickEstimatedMinutes/)
  assert.doesNotMatch(projectTasks, /newTaskEstimatedMinutes|Planned time in minutes/)

  const projectsHeader = read("components/projects/projects-header-controls.tsx")
  assert.match(projectsHeader, /SheetContent side="bottom"/)
  assert.match(projectsHeader, /ProjectsStatusControls/)

  const projectCards = read("components/projects/projects-board-rows.tsx")
  assert.match(projectCards, /sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4/)
  assert.match(projectCards, /Recurring projects/)

  const paymentBalances = read("components/payments/payment-balances-table.tsx")
  assert.match(paymentBalances, /hidden overflow-x-auto[^"]+md:block/)
  assert.match(paymentBalances, /grid gap-3 md:hidden/)
  assert.match(paymentBalances, /SheetContent side="bottom"/)

  const tasksPagination = read("components/tasks/tasks-pagination-bar.tsx")
  assert.match(tasksPagination, /if \(!display\.shouldPaginate\) return null/)

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
