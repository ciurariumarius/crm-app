"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDownUp, Check, RefreshCw, SlidersHorizontal, Smartphone, X } from "lucide-react"
import { toast } from "sonner"
import { syncTickTickNow } from "@/lib/actions/integrations"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTasksSearchContext } from "./tasks-search-context"

const SORT_OPTIONS = [
  { label: "Creation date (Newest first)", value: "newest" },
  { label: "Creation date (Oldest first)", value: "oldest" },
  { label: "Last updated", value: "updated" },
  { label: "Name (A-Z)", value: "name_asc" },
  { label: "Name (Z-A)", value: "name_desc" },
] as const

const STATUS_OPTIONS = [
  { label: "Open", value: "Active" },
  { label: "Pending", value: "Pending" },
  { label: "Done", value: "Completed" },
] as const

const PRIORITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
  { label: "Low", value: "Low" },
] as const

const SCOPE_OPTIONS = [
  { label: "All targets", value: "ALL" },
  { label: "Freelance", value: "FREELANCE" },
  { label: "LMS", value: "LMS" },
] as const

type DraftFilters = {
  urgency: string
  scope: string
  projectId: string
  taskId: string
  partnerId: string
  sort: string
}

const RESET_FILTERS: DraftFilters = {
  urgency: "all",
  scope: "ALL",
  projectId: "all",
  taskId: "all",
  partnerId: "all",
  sort: "newest",
}

export type TasksHeaderFilterProps = {
  projects: { id: string; name: string }[]
  partners: { id: string; name: string }[]
  currentUrgency: string
  currentOverdue?: boolean
  currentDueToday?: boolean
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
  if (props.currentTaskId !== "all") activeFilters.push({ key: "taskId", label: "Selected task", href: buildHref({ taskId: "all" }) })
  if (props.currentProject !== "all" && selectedProject) activeFilters.push({ key: "projectId", label: selectedProject.name, href: buildHref({ projectId: "all" }) })
  if (props.currentPartner !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: selectedPartner.name, href: buildHref({ partnerId: "all" }) })
  if (props.currentScope !== "ALL" && selectedScope) activeFilters.push({ key: "scope", label: selectedScope.label, href: buildHref({ scope: "ALL" }) })
  if (props.currentSort !== "newest" && selectedSort) activeFilters.push({ key: "sort", label: selectedSort.label, href: buildHref({ sort: "newest" }) })

  return activeFilters
}

export function TasksStatusControls({
  currentStatus,
  activeCount,
  pendingCount,
}: {
  currentStatus: string
  activeCount?: number
  pendingCount?: number
}) {
  const buildHref = useTasksHref()
  const searchContext = useTasksSearchContext()
  const displayedStatus = searchContext?.searchTerm.trim() && !searchContext.statusRefined
    ? "All"
    : currentStatus || "Active"

  return (
    <nav className="flex flex-1 items-center justify-around md:justify-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 xl:gap-5 px-1 md:px-2 lg:px-3 h-11 md:h-auto rounded-2xl border border-[var(--line-subtle)] md:border-none bg-[var(--surface-lowest)] md:bg-transparent md:shadow-none shadow-[var(--shadow-apple)]" aria-label="Task status">
      {STATUS_OPTIONS.map((option) => {
        const isCurrent = displayedStatus === option.value
          || (option.value === "Active" && (displayedStatus === "All" && !searchContext?.searchTerm.trim()))
          || (option.value === "Active" && !currentStatus)

        return (
          <Link
            key={option.value}
            href={buildHref({ status: option.value })}
            onClick={() => searchContext?.setStatusRefined(true)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "group relative inline-flex items-center justify-center gap-1.5 h-full px-2 sm:px-2.5 md:py-2 text-[14px] sm:text-[15px] font-semibold tracking-[-0.01em] transition-colors",
              isCurrent
                ? "text-[var(--brand-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <span>{option.label}</span>
            {option.value === "Active" && typeof activeCount === "number" && activeCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)] px-1.5 text-xs font-bold text-[var(--brand-primary)]">
                {activeCount}
              </span>
            ) : null}
            {option.value === "Pending" && typeof pendingCount === "number" && pendingCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100/90 px-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {pendingCount}
              </span>
            ) : null}
            {isCurrent ? (
              <span className="absolute inset-x-2 bottom-0 md:-bottom-1 h-[2.5px] rounded-t-full md:rounded-full bg-[var(--brand-primary)]" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function TasksSortControl({ currentSort }: { currentSort: string }) {
  const router = useRouter()
  const buildHref = useTasksHref()
  const isCustomSort = Boolean(currentSort && currentSort !== "newest")

  const handleSortSelect = (sortValue: string) => {
    router.push(buildHref({ sort: sortValue === "newest" ? null : sortValue }))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-11 w-11 shrink-0 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
          aria-label={`Sort tasks${isCustomSort ? ` (${currentSort})` : ""}`}
          title="Sort tasks"
        >
          <ArrowDownUp className="h-4.5 w-4.5" />
          {isCustomSort ? (
            <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1.5 shadow-xl">
        <div className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Sort by
        </div>
        {SORT_OPTIONS.map((option) => {
          const isSelected = (currentSort || "newest") === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => handleSortSelect(option.value)}
              className="cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold"
            >
              <span>{option.label}</span>
              {isSelected ? <Check className="ml-auto h-3.5 w-3.5 text-[var(--primary)]" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TasksFilterControl(props: TasksHeaderFilterProps) {
  const router = useRouter()
  const buildHref = useTasksHref()
  const [desktopOpen, setDesktopOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DraftFilters>(RESET_FILTERS)
  const activeFilters = getActiveFilters(props, buildHref)

  const currentDraft = React.useCallback((): DraftFilters => ({
    urgency: props.currentUrgency,
    scope: props.currentScope,
    projectId: props.currentProject,
    taskId: props.currentTaskId,
    partnerId: props.currentPartner,
    sort: props.currentSort,
  }), [props.currentPartner, props.currentProject, props.currentScope, props.currentSort, props.currentTaskId, props.currentUrgency])

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
      size="icon"
      className="relative h-11 w-11 shrink-0 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] shadow-[var(--shadow-apple)] md:shadow-none hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)]"
      aria-label={`Filters${activeFilters.length ? `, ${activeFilters.length} active` : ""}`}
      title="Filters"
    >
      <SlidersHorizontal className="h-4.5 w-4.5" />
      {activeFilters.length > 0 ? (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-xs font-bold text-white shadow-sm">
          {activeFilters.length}
        </span>
      ) : null}
    </Button>
  )

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <div className="hidden md:block">
        <TasksSortControl currentSort={props.currentSort} />
      </div>

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
  const router = useRouter()
  const [isSyncing, setIsSyncing] = React.useState(false)

  const handleSyncTickTick = async () => {
    setIsSyncing(true)
    try {
      const res = await syncTickTickNow()
      if (res.success) {
        const total = (res.importedCount || 0) + (res.completedInPixelistCount || 0) + (res.pushedToTickTickCount || 0) + (res.completedInTickTickCount || 0)
        if (total > 0) {
          toast.success(`TickTick sync: ${res.importedCount} imported, ${res.completedInPixelistCount} completed in app, ${res.pushedToTickTickCount} pushed`)
        } else {
          toast.success("TickTick is up to date!")
        }
        router.refresh()
      } else {
        toast.error(res.error || "TickTick sync failed")
      }
    } catch {
      toast.error("Failed to sync TickTick tasks")
    } finally {
      setIsSyncing(false)
    }
  }

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

        <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)]/50 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:color-mix(in_srgb,#6366f1_14%,transparent)] text-[#6366f1] dark:bg-[color:color-mix(in_srgb,#818cf8_18%,transparent)] dark:text-[#818cf8]">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">TickTick Sync</p>
              <p className="text-xs text-[var(--text-muted)]">Import & sync tasks with TickTick</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={handleSyncTickTick}
            className="h-8 gap-1.5 text-xs font-semibold border-[var(--line-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-primary")} />
            {isSyncing ? "Syncing..." : "Sync now"}
          </Button>
        </div>
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
