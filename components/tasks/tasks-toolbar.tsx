"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarClock, CalendarDays, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useTasksSearchContext } from "./tasks-search-context"

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Recently updated", value: "updated" },
  { label: "Name A-Z", value: "name_asc" },
  { label: "Name Z-A", value: "name_desc" },
] as const

const STATUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Active", value: "Active" },
  { label: "Completed", value: "Completed" },
] as const

const PRIORITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Urgent", value: "Urgent" },
  { label: "Normal", value: "Normal" },
  { label: "Idea", value: "Idea" },
] as const

const SCOPE_OPTIONS = [
  { label: "All targets", value: "ALL" },
  { label: "Freelance", value: "FREELANCE" },
  { label: "LMS", value: "LMS" },
] as const

type DraftFilters = {
  urgency: string
  scope: string
  overdue: boolean
  dueToday: boolean
  projectId: string
  taskId: string
  partnerId: string
  sort: string
}

const RESET_FILTERS: DraftFilters = {
  urgency: "all",
  scope: "ALL",
  overdue: false,
  dueToday: false,
  projectId: "all",
  taskId: "all",
  partnerId: "all",
  sort: "newest",
}

export type TasksHeaderFilterProps = {
  projects: { id: string; name: string }[]
  partners: { id: string; name: string }[]
  currentUrgency: string
  currentOverdue: boolean
  currentDueToday: boolean
  currentSort: string
  currentProject: string
  currentTaskId: string
  currentPartner: string
  currentScope: string
  totalTasks: number
}

function useTasksHref() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchContext = useTasksSearchContext()

  return React.useCallback((overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    // The Tasks grid is now responsive and fixed. Old bookmarked column values
    // remain valid URLs, but are intentionally removed on the next navigation.
    params.delete("cols")

    Object.entries(overrides).forEach(([key, value]) => {
      const hasSearch = Boolean(searchContext?.searchTerm.trim() || searchParams.get("q"))
      const isDefault =
        (key === "status" && value === "Active" && !hasSearch) ||
        (key === "urgency" && value === "all") ||
        (key === "sort" && value === "newest") ||
        (key === "projectId" && value === "all") ||
        (key === "taskId" && (value === "all" || !value)) ||
        (key === "partnerId" && value === "all") ||
        (key === "scope" && value === "ALL")

      if (value === null || isDefault) params.delete(key)
      else params.set(key, value)
    })

    params.delete("page")
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchContext?.searchTerm, searchParams])
}

function getActiveFilters(
  props: TasksHeaderFilterProps,
  buildHref: (overrides: Record<string, string | null>) => string
) {
  const selectedProject = props.projects.find((project) => project.id === props.currentProject)
  const selectedPartner = props.partners.find((partner) => partner.id === props.currentPartner)
  const selectedSort = SORT_OPTIONS.find((option) => option.value === props.currentSort)
  const selectedScope = SCOPE_OPTIONS.find((option) => option.value === props.currentScope)
  const activeFilters: { key: string; label: string; href: string }[] = []

  if (props.currentUrgency !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${props.currentUrgency}`, href: buildHref({ urgency: "all" }) })
  if (props.currentOverdue) activeFilters.push({ key: "overdue", label: "Overdue", href: buildHref({ overdue: null }) })
  if (props.currentDueToday) activeFilters.push({ key: "dueToday", label: "Due today", href: buildHref({ dueToday: null }) })
  if (props.currentTaskId !== "all") activeFilters.push({ key: "taskId", label: "Selected task", href: buildHref({ taskId: "all" }) })
  if (props.currentProject !== "all" && selectedProject) activeFilters.push({ key: "projectId", label: selectedProject.name, href: buildHref({ projectId: "all" }) })
  if (props.currentPartner !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: selectedPartner.name, href: buildHref({ partnerId: "all" }) })
  if (props.currentScope !== "ALL" && selectedScope) activeFilters.push({ key: "scope", label: selectedScope.label, href: buildHref({ scope: "ALL" }) })
  if (props.currentSort !== "newest" && selectedSort) activeFilters.push({ key: "sort", label: selectedSort.label, href: buildHref({ sort: "newest" }) })

  return activeFilters
}

export function TasksStatusControls({ currentStatus }: { currentStatus: string }) {
  const buildHref = useTasksHref()
  const searchContext = useTasksSearchContext()
  const displayedStatus = searchContext?.searchTerm.trim() && !searchContext.statusRefined
    ? "All"
    : currentStatus

  return (
    <nav className="inline-flex h-9 min-w-0 items-center rounded-xl bg-[var(--bg-surface-soft)] p-1" aria-label="Task status">
      {STATUS_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={buildHref({ status: option.value })}
          onClick={() => searchContext?.setStatusRefined(true)}
          aria-current={displayedStatus === option.value ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold uppercase tracking-[0.035em] transition-colors sm:px-3",
            displayedStatus === option.value
              ? "bg-[var(--brand-primary)] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  )
}

export function TasksFilterControl(props: TasksHeaderFilterProps) {
  const router = useRouter()
  const searchContext = useTasksSearchContext()
  const buildHref = useTasksHref()
  const [desktopOpen, setDesktopOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DraftFilters>(RESET_FILTERS)
  const activeFilters = getActiveFilters(props, buildHref)

  const currentDraft = React.useCallback((): DraftFilters => ({
    urgency: props.currentUrgency,
    scope: props.currentScope,
    overdue: props.currentOverdue,
    dueToday: props.currentDueToday,
    projectId: props.currentProject,
    taskId: props.currentTaskId,
    partnerId: props.currentPartner,
    sort: props.currentSort,
  }), [props.currentDueToday, props.currentOverdue, props.currentPartner, props.currentProject, props.currentScope, props.currentSort, props.currentTaskId, props.currentUrgency])

  const openDesktop = (nextOpen: boolean) => {
    if (nextOpen) setDraft(currentDraft())
    setDesktopOpen(nextOpen)
  }

  const openMobile = (nextOpen: boolean) => {
    if (nextOpen) setDraft(currentDraft())
    setMobileOpen(nextOpen)
  }

  const closePanels = () => {
    setDesktopOpen(false)
    setMobileOpen(false)
  }

  const applyDraft = () => {
    router.push(buildHref({
      urgency: draft.urgency,
      scope: draft.scope,
      overdue: draft.overdue ? "1" : null,
      dueToday: draft.dueToday ? "1" : null,
      projectId: draft.projectId,
      taskId: draft.taskId,
      partnerId: draft.partnerId,
      sort: draft.sort,
    }))
    closePanels()
  }

  const panel = (
    <FiltersPanel
      projects={props.projects}
      partners={props.partners}
      draft={draft}
      setDraft={setDraft}
      onApply={applyDraft}
      onReset={() => setDraft(RESET_FILTERS)}
      onCancel={closePanels}
    />
  )

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 rounded-xl px-2.5 sm:px-3"
      aria-label={`Filters${activeFilters.length ? `, ${activeFilters.length} active` : ""}`}
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span className="hidden sm:inline">Filters</span>
      {activeFilters.length > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1.5 text-xs font-bold text-white">
          {activeFilters.length}
        </span>
      ) : null}
    </Button>
  )

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <div className="hidden md:block">
        <Popover open={desktopOpen} onOpenChange={openDesktop}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-[540px] rounded-[16px] p-0">
            {panel}
          </PopoverContent>
        </Popover>
      </div>

      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={openMobile}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-[22px] p-0" showCloseButton={false}>
            <SheetHeader className="px-4 pb-2 pt-4 text-left">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Refine the tasks shown in the list.</SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

export function TasksActiveFilterChips(props: TasksHeaderFilterProps) {
  const buildHref = useTasksHref()
  const activeFilters = getActiveFilters(props, buildHref)

  if (activeFilters.length === 0) return null

  const clearHref = buildHref({
    urgency: "all",
    overdue: null,
    dueToday: null,
    sort: "newest",
    projectId: "all",
    taskId: "all",
    partnerId: "all",
    scope: "ALL",
  })

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-t border-[var(--line-subtle)] pt-2.5 hidescrollbar">
      {activeFilters.map((filter) => (
        <Link
          key={filter.key}
          href={filter.href}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-primary)_24%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,var(--surface-lowest))] px-2.5 text-xs font-semibold text-[var(--brand-primary)]"
        >
          {filter.label}
          <X className="h-3 w-3" aria-hidden="true" />
        </Link>
      ))}
      <Link href={clearHref} className="h-7 shrink-0 px-2 text-xs font-semibold leading-7 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        Clear
      </Link>
    </div>
  )
}

function FiltersPanel({ projects, partners, draft, setDraft, onApply, onReset, onCancel }: {
  projects: { id: string; name: string }[]
  partners: { id: string; name: string }[]
  draft: DraftFilters
  setDraft: React.Dispatch<React.SetStateAction<DraftFilters>>
  onApply: () => void
  onReset: () => void
  onCancel: () => void
}) {
  return (
    <div className="p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterField label="Priority">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--bg-surface-soft)] p-1">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, urgency: option.value }))}
                className={cn(
                  "h-8 rounded-lg px-1 text-xs font-semibold transition-colors",
                  draft.urgency === option.value
                    ? "bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterField>

        <FilterField label="Target">
          <Select value={draft.scope} onValueChange={(scope) => setDraft((current) => ({ ...current, scope, projectId: "all", taskId: "all", partnerId: "all" }))}>
            <SelectTrigger size="sm" className="w-full shadow-none" aria-label="Target filter"><SelectValue /></SelectTrigger>
            <SelectContent>{SCOPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Schedule">
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton active={draft.overdue} onClick={() => setDraft((current) => ({ ...current, overdue: !current.overdue, dueToday: false }))} icon={<CalendarClock className="h-4 w-4" />} label="Overdue" />
            <ToggleButton active={draft.dueToday} onClick={() => setDraft((current) => ({ ...current, dueToday: !current.dueToday, overdue: false }))} icon={<CalendarDays className="h-4 w-4" />} label="Due today" />
          </div>
        </FilterField>

        <FilterField label="Project">
          <Select value={draft.projectId} onValueChange={(projectId) => setDraft((current) => ({ ...current, projectId, taskId: "all", partnerId: projectId === "all" ? current.partnerId : "all", scope: projectId === "all" ? current.scope : "FREELANCE" }))}>
            <SelectTrigger size="sm" className="w-full shadow-none" aria-label="Project filter"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Partner">
          <Select value={draft.partnerId} onValueChange={(partnerId) => setDraft((current) => ({ ...current, partnerId, taskId: "all", projectId: partnerId === "all" ? current.projectId : "all", scope: partnerId === "all" ? current.scope : "FREELANCE" }))}>
            <SelectTrigger size="sm" className="w-full shadow-none" aria-label="Partner filter"><SelectValue placeholder="All partners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All partners</SelectItem>
              {partners.map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Sort">
          <Select value={draft.sort} onValueChange={(sort) => setDraft((current) => ({ ...current, sort }))}>
            <SelectTrigger size="sm" className="w-full shadow-none" aria-label="Sort tasks"><SelectValue /></SelectTrigger>
            <SelectContent>{SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterField>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>Reset</Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" onClick={onApply}>Apply</Button>
        </div>
      </div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</p>
      {children}
    </div>
  )
}

function ToggleButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold transition-colors",
        active
          ? "border-[var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,var(--surface-lowest))] text-[var(--brand-primary)]"
          : "border-[var(--line-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
      )}
    >
      {icon}{label}
    </button>
  )
}
