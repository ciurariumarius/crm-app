"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Lightbulb,
  CalendarClock,
  ChevronDown,
  SlidersHorizontal,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilterBarShell, FilterResultsRow } from "@/components/ui/filter-bar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useTasksSearchContext } from "./tasks-search-context"

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Recently Updated", value: "updated" },
  { label: "Name A-Z", value: "name_asc" },
  { label: "Name Z-A", value: "name_desc" },
]

const STATUS_OPTIONS = [
  { label: "All", value: "All", dotClass: "bg-[var(--text-muted)]", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Active", value: "Active", dotClass: "bg-emerald-500", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Completed", value: "Completed", dotClass: "bg-[var(--brand-primary-strong)]", activeClass: "bg-[var(--brand-primary)] text-white shadow-[var(--shadow-apple)]" },
]

const PRIORITY_OPTIONS = [
  { label: "All", value: "all", icon: <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Urgent", value: "Urgent", icon: <AlertTriangle className="h-3 w-3" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Normal", value: "Normal", icon: <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Idea", value: "Idea", icon: <Lightbulb className="h-3 w-3" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
]

function triggerClassName(isActive: boolean, extraClassName?: string) {
  return cn(
    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-all shadow-[var(--shadow-apple)]",
    isActive
      ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_16%,var(--surface-lowest))] text-[var(--brand-primary)]"
      : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]",
    extraClassName
  )
}

export function TasksToolbar({
  projects,
  partners,
  currentStatus,
  currentUrgency,
  currentOverdue,
  currentDueToday,
  currentSort,
  currentCols,
  currentProject,
  currentTaskId,
  currentPartner,
  totalTasks,
}: {
  projects: { id: string; name: string }[]
  partners: { id: string; name: string }[]
  currentStatus: string
  currentUrgency: string
  currentOverdue: boolean
  currentDueToday: boolean
  currentSort: string
  currentCols: number
  currentProject: string
  currentTaskId: string
  currentPartner: string
  totalTasks: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchContext = useTasksSearchContext()

  const buildHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(overrides).forEach(([key, value]) => {
      const isDefaultStatus = key === "status" && value === "Active"
      const isDefaultUrgency = key === "urgency" && value === "all"
      const isDefaultSort = key === "sort" && value === "newest"
      const isDefaultCols = key === "cols" && value === "3"
      const isDefaultProject = key === "projectId" && value === "all"
      const isDefaultTask = key === "taskId" && (value === "all" || !value)
      const isDefaultPartner = key === "partnerId" && value === "all"

      if (
        value === null ||
        isDefaultStatus ||
        isDefaultUrgency ||
        isDefaultSort ||
        isDefaultCols ||
        isDefaultProject ||
        isDefaultTask ||
        isDefaultPartner
      ) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    params.delete("page")
    return `${pathname}?${params.toString()}`
  }

  const pushWithOverrides = (overrides: Record<string, string | null>) => {
    router.push(buildHref(overrides))
  }

  const clearAllHref = buildHref({
    status: "Active",
    urgency: "all",
    overdue: null,
    dueToday: null,
    sort: "newest",
    projectId: null,
    taskId: null,
    partnerId: null,
  })

  const hasSearchTerm = Boolean(searchContext?.searchTerm.trim())
  const searchResultCount = searchContext?.searchResultCount
  const displayTotal = hasSearchTerm && searchResultCount !== null && searchResultCount !== undefined
    ? searchResultCount
    : totalTasks
  const resultsLabel = searchContext?.isSearching ? "Searching..." : `${displayTotal} Results found`

  const selectedProject = projects.find((project) => project.id === currentProject)
  const selectedPartner = partners.find((partner) => partner.id === currentPartner)
  const selectedSort = SORT_OPTIONS.find((option) => option.value === currentSort)
  const activeFilters: { key: string; label: string; href: string }[] = []
  if (currentStatus !== "Active") activeFilters.push({ key: "status", label: `Status: ${currentStatus}`, href: buildHref({ status: "Active" }) })
  if (currentUrgency !== "all") activeFilters.push({ key: "urgency", label: `Priority: ${currentUrgency}`, href: buildHref({ urgency: "all" }) })
  if (currentOverdue) activeFilters.push({ key: "overdue", label: "Overdue", href: buildHref({ overdue: null }) })
  if (currentDueToday) activeFilters.push({ key: "dueToday", label: "Due today", href: buildHref({ dueToday: null }) })
  if (currentTaskId !== "all") activeFilters.push({ key: "taskId", label: "Task: Selected", href: buildHref({ taskId: "all" }) })
  if (currentProject !== "all" && selectedProject) activeFilters.push({ key: "projectId", label: `Project: ${selectedProject.name}`, href: buildHref({ projectId: "all" }) })
  if (currentPartner !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner.name}`, href: buildHref({ partnerId: "all" }) })
  if (currentSort !== "newest" && selectedSort) activeFilters.push({ key: "sort", label: `Sort: ${selectedSort.label}`, href: buildHref({ sort: "newest" }) })

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <FilterBarShell className="rounded-[16px] border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 py-2.5 shadow-[var(--shadow-apple)] sm:px-3.5 sm:py-3">
        <div className="relative -mx-1 sm:mx-0">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-[var(--surface-lowest)] via-[color:color-mix(in_srgb,var(--surface-lowest)_90%,transparent)] to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-gradient-to-l from-[var(--surface-lowest)] via-[color:color-mix(in_srgb,var(--surface-lowest)_90%,transparent)] to-transparent sm:hidden" />
          <div className="overflow-x-auto px-1 pb-0.5 hidescrollbar snap-x snap-mandatory scroll-px-3 touch-pan-x overscroll-x-contain xl:overflow-visible xl:px-0">
          <div className="inline-flex min-w-max items-center gap-2 xl:flex xl:w-full xl:min-w-0 xl:items-center xl:gap-3 2xl:gap-4">
            <div className="inline-flex h-9 shrink-0 snap-start items-center rounded-xl bg-[var(--bg-surface-soft)] p-1">
              {STATUS_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={buildHref({ status: option.value })}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors",
                    currentStatus === option.value ? option.activeClass : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {option.value !== "All" ? <span className={cn("h-2 w-2 rounded-full", option.dotClass)} /> : null}
                  {option.label}
                </Link>
              ))}
            </div>

            <div className="inline-flex h-9 shrink-0 snap-start items-center rounded-xl bg-[var(--bg-surface-soft)] p-1">
              {PRIORITY_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={buildHref({ urgency: option.value })}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors",
                    currentUrgency === option.value ? option.activeClass : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {option.value !== "all" ? option.icon : null}
                  {option.label}
                </Link>
              ))}
            </div>

            <Link
              href={buildHref({ overdue: currentOverdue ? null : "1" })}
              className={cn(
                "inline-flex h-9 shrink-0 snap-start items-center justify-between gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-colors shadow-[var(--shadow-apple)]",
                currentOverdue
                  ? "border-[color:color-mix(in_srgb,var(--state-overdue)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--state-overdue)_14%,var(--surface-lowest))] text-[var(--state-overdue)] ring-1 ring-[color:color-mix(in_srgb,var(--state-overdue)_22%,transparent)]"
                  : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]"
              )}
            >
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Overdue</span>
              </span>
              {currentOverdue ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--state-overdue)_24%,var(--surface-lowest))] text-[var(--state-overdue)]">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </Link>

            <div className="shrink-0 snap-start xl:min-w-[160px] xl:flex-1">
              <ProjectCombobox
                projects={projects}
                currentProject={currentProject}
                onSelect={(value) => {
                  const overrides: Record<string, string | null> = { projectId: value, taskId: null }
                  if (value !== "all") overrides.partnerId = null
                  pushWithOverrides(overrides)
                }}
              />
            </div>

            <div className="shrink-0 snap-start xl:min-w-[150px] xl:flex-1">
              <PartnerCombobox
                partners={partners}
                currentPartner={currentPartner}
                onSelect={(value) => {
                  const overrides: Record<string, string | null> = { partnerId: value, taskId: null }
                  if (value !== "all") overrides.projectId = null
                  pushWithOverrides(overrides)
                }}
              />
            </div>

            <div className="shrink-0 snap-start xl:ml-auto">
              <SortCombobox currentSort={currentSort} onSelect={(value) => pushWithOverrides({ sort: value })} />
            </div>
            <div className="shrink-0 snap-start">
              <ColumnsToggle currentCols={currentCols} onSelect={(value) => pushWithOverrides({ cols: String(value) })} />
            </div>
          </div>
          </div>
        </div>
      </FilterBarShell>

      <FilterResultsRow className="justify-between gap-2 px-0 py-0.5 shadow-none">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-primary)] sm:text-xs">{resultsLabel}</p>
          <div className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5 hidescrollbar">
            {activeFilters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.href}
                className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,var(--surface-lowest))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_12%,var(--surface-lowest))] px-2 text-[9px] font-semibold uppercase tracking-[0.03em] text-[var(--brand-primary)] sm:h-6 sm:text-[10px]"
              >
                <span>{filter.label}</span>
                <span className="text-[var(--brand-primary)]/70">×</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeFilters.length > 0 ? (
            <Link
              href={clearAllHref}
              className="inline-flex h-6 items-center rounded-full px-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] sm:text-[10px]"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      </FilterResultsRow>
    </div>
  )
}

function ColumnsToggle({
  currentCols,
  onSelect,
}: {
  currentCols: number
  onSelect: (value: 3 | 4) => void
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-1 shadow-[var(--shadow-apple)]">
      {[3, 4].map((col) => (
        <button
          key={col}
          type="button"
          title={`${col} columns`}
          onClick={() => onSelect(col as 3 | 4)}
          className={cn(
            "inline-flex h-7 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition-colors",
            currentCols === col ? "bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
        >
          {col}
        </button>
      ))}
    </div>
  )
}

function SortCombobox({
  currentSort,
  onSelect,
}: {
  currentSort: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const isActive = currentSort !== "newest"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Sort tasks" aria-label="Sort tasks" className={triggerClassName(isActive, "h-9 w-9 justify-center px-0")}>
          <SlidersHorizontal className={cn("h-4 w-4", isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0">
        <Command className="rounded-xl">
          <CommandList>
            <CommandGroup>
              {SORT_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded-lg"
                >
                  <Check className={cn("mr-2 h-4 w-4", currentSort === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ProjectCombobox({
  projects,
  currentProject,
  onSelect,
}: {
  projects: { id: string; name: string }[]
  currentProject: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const isActive = currentProject !== "all"
  const selectedProject = projects.find((project) => project.id === currentProject)

  return (
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName(isActive, "w-full justify-between md:min-w-0")}>
          <span className="max-w-[140px] truncate">{selectedProject?.name || "Project"}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <Command className="rounded-xl">
          <CommandInput placeholder="Search project..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all projects"
                onSelect={() => {
                  onSelect("all")
                  setOpen(false)
                }}
                className="cursor-pointer rounded-lg"
              >
                <Check className={cn("mr-2 h-4 w-4", !isActive ? "opacity-100" : "opacity-0")} />
                All projects
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => {
                    onSelect(project.id)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded-lg"
                >
                  <Check className={cn("mr-2 h-4 w-4", currentProject === project.id ? "opacity-100" : "opacity-0")} />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function PartnerCombobox({
  partners,
  currentPartner,
  onSelect,
}: {
  partners: { id: string; name: string }[]
  currentPartner: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const isActive = currentPartner !== "all"
  const selectedPartner = partners.find((partner) => partner.id === currentPartner)

  return (
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName(isActive, "w-full justify-between md:min-w-0")}>
          <span className="max-w-[140px] truncate">{selectedPartner?.name || "Partner"}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <Command className="rounded-xl">
          <CommandInput placeholder="Search partner..." />
          <CommandList>
            <CommandEmpty>No partner found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all partners"
                onSelect={() => {
                  onSelect("all")
                  setOpen(false)
                }}
                className="cursor-pointer rounded-lg"
              >
                <Check className={cn("mr-2 h-4 w-4", !isActive ? "opacity-100" : "opacity-0")} />
                All partners
              </CommandItem>
              {partners.map((partner) => (
                <CommandItem
                  key={partner.id}
                  value={partner.name}
                  onSelect={() => {
                    onSelect(partner.id)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded-lg"
                >
                  <Check className={cn("mr-2 h-4 w-4", currentPartner === partner.id ? "opacity-100" : "opacity-0")} />
                  {partner.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
