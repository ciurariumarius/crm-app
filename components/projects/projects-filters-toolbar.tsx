"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, parseISO } from "date-fns"
import {
  Wallet,
  AlertCircle,
  ChevronDown,
  SlidersHorizontal,
  Check,
  LayoutGrid,
  Table2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilterBarShell, FilterResultsRow } from "@/components/ui/filter-bar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { DateRange } from "react-day-picker"

const STATUS_OPTIONS = [
  { label: "All", value: "All", dotClass: "bg-[var(--text-muted)]", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Active", value: "Active", dotClass: "bg-emerald-500", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Pause", value: "Paused", dotClass: "bg-amber-500", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Done", value: "Completed", dotClass: "bg-[var(--brand-primary-strong)]", activeClass: "bg-[var(--brand-primary)] text-white shadow-[var(--shadow-apple)]" },
  { label: "Closed", value: "Closed", dotClass: "bg-[var(--text-secondary)]", activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
]

const PAYMENT_OPTIONS = [
  { label: "All", value: "All", icon: null, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Paid", value: "Paid", icon: <Wallet className="h-3 w-3" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
  { label: "Unpaid", value: "Unpaid", icon: <AlertCircle className="h-3 w-3" />, activeClass: "bg-[var(--brand-cyan)] text-white shadow-sm" },
]

const RECURRING_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Monthly", value: "Recurring" },
  { label: "One-time", value: "OneTime" },
]

const PERIOD_OPTIONS = [
  { label: "All Time", value: "all_time" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "This Year", value: "this_year" },
  { label: "Last Year", value: "last_year" },
]

const SORT_OPTIONS = [
  { label: "Recently Updated", value: "updated_desc" },
  { label: "Created (Newest)", value: "created_desc" },
  { label: "Created (Oldest)", value: "created_asc" },
  { label: "Amount (High-Low)", value: "amount_desc" },
  { label: "Amount (Low-High)", value: "amount_asc" },
  { label: "Time (Most)", value: "time_desc" },
  { label: "Time (Least)", value: "time_asc" },
  { label: "Name (A-Z)", value: "name_asc" },
  { label: "Name (Z-A)", value: "name_desc" },
]
const DEFAULT_SORT = "amount_desc"

function toYmd(value: Date) {
  return format(value, "yyyy-MM-dd")
}

function parseMaybeDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

function triggerClassName(isActive: boolean, extraClassName?: string) {
  return cn(
    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all shadow-[var(--shadow-apple)]",
    isActive
      ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_16%,var(--surface-lowest))] text-[var(--brand-primary)]"
      : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)] hover:bg-[color:color-mix(in_srgb,var(--surface-lowest)_90%,var(--surface-low)_10%)]",
    extraClassName
  )
}

export function ProjectsFiltersToolbar({
  partners,
  currentStatus,
  currentPayment,
  currentRecurring,
  currentPeriod,
  currentFrom,
  currentTo,
  currentSort,
  currentView,
  currentProjectId,
  currentProjectLabel,
  currentPartnerId,
}: {
  partners: { id: string; name: string }[]
  currentStatus: string
  currentPayment: string
  currentRecurring: string
  currentPeriod: string
  currentFrom: string
  currentTo: string
  currentSort: string
  currentView: "grid" | "list"
  currentProjectId: string
  currentProjectLabel?: string
  currentPartnerId: string
  totalProjects?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buildHref = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(overrides).forEach(([key, value]) => {
      const isDefaultStatus = key === "status" && value === "Active"
      const isDefaultPayment = key === "payment" && value === "All"
      const isDefaultRecurring = key === "recurring" && value === "All"
      const isDefaultPeriod = key === "period" && value === "all_time"
      const isDefaultSort = key === "sort" && value === DEFAULT_SORT
      const isDefaultProject = key === "projectId" && (value === "all" || !value)
      const isDefaultPartner = key === "partnerId" && value === "all"
      const isDefaultFrom = key === "from" && !value
      const isDefaultTo = key === "to" && !value
      const isDefaultView = key === "view" && (value === "list" || !value)

      if (
        value === null ||
        isDefaultStatus ||
        isDefaultPayment ||
        isDefaultRecurring ||
        isDefaultPeriod ||
        isDefaultSort ||
        isDefaultProject ||
        isDefaultPartner ||
        isDefaultFrom ||
        isDefaultTo ||
        isDefaultView
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

  const selectedPartner = partners.find((partner) => partner.id === currentPartnerId)
  const selectedPeriod = PERIOD_OPTIONS.find((option) => option.value === currentPeriod) ?? PERIOD_OPTIONS[0]
  const selectedSort =
    SORT_OPTIONS.find((option) => option.value === currentSort) ??
    SORT_OPTIONS.find((option) => option.value === DEFAULT_SORT) ??
    SORT_OPTIONS[0]
  const fromDate = parseMaybeDate(currentFrom)
  const toDate = parseMaybeDate(currentTo)
  const hasCustomRange = Boolean(fromDate || toDate)
  const customRangeLabel = hasCustomRange
    ? `${fromDate ? format(fromDate, "dd MMM yyyy") : "…"} - ${toDate ? format(toDate, "dd MMM yyyy") : "…"}`
    : null

  const activeFilters: { key: string; label: string; href: string }[] = []
  if (currentStatus !== "Active") activeFilters.push({ key: "status", label: `Status: ${currentStatus}`, href: buildHref({ status: "Active" }) })
  if (currentPayment !== "All") activeFilters.push({ key: "payment", label: `Payment: ${currentPayment}`, href: buildHref({ payment: "All" }) })
  if (currentRecurring !== "All") activeFilters.push({ key: "recurring", label: `Type: ${RECURRING_OPTIONS.find((option) => option.value === currentRecurring)?.label || currentRecurring}`, href: buildHref({ recurring: "All" }) })
  if (currentProjectId !== "all") activeFilters.push({ key: "projectId", label: `Project: ${currentProjectLabel || "Selected"}`, href: buildHref({ projectId: "all" }) })
  if (currentPartnerId !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner.name}`, href: buildHref({ partnerId: "all" }) })
  if (hasCustomRange) activeFilters.push({ key: "period_custom", label: `Period: ${customRangeLabel}`, href: buildHref({ period: "all_time", from: null, to: null }) })
  if (!hasCustomRange && currentPeriod !== "all_time") activeFilters.push({ key: "period", label: `Period: ${selectedPeriod.label}`, href: buildHref({ period: "all_time", from: null, to: null }) })
  if (currentSort !== DEFAULT_SORT) activeFilters.push({ key: "sort", label: `Sort: ${selectedSort.label}`, href: buildHref({ sort: DEFAULT_SORT }) })

  const clearAllHref = buildHref({
    status: "Active",
    payment: "All",
    recurring: "All",
    projectId: null,
    partnerId: null,
    period: "all_time",
    from: null,
    to: null,
    sort: DEFAULT_SORT,
  })

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
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.04em] transition-colors",
                    currentStatus === option.value ? option.activeClass : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {option.value !== "All" ? <span className={cn("h-2 w-2 rounded-full", option.dotClass)} /> : null}
                  {option.label}
                </Link>
              ))}
            </div>

            <div className="inline-flex h-9 shrink-0 snap-start items-center rounded-xl bg-[var(--bg-surface-soft)] p-1">
              {PAYMENT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={buildHref({ payment: option.value })}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.04em] transition-colors",
                    currentPayment === option.value ? option.activeClass : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                  {option.label}
                </Link>
              ))}
            </div>

            <div className="shrink-0 snap-start xl:min-w-[120px] xl:flex-1">
              <TypeCombobox currentRecurring={currentRecurring} onSelect={(value) => pushWithOverrides({ recurring: value })} />
            </div>

            <div className="shrink-0 snap-start xl:min-w-[150px] xl:flex-[1.1]">
              <PartnerCombobox
                partners={partners}
                currentPartnerId={currentPartnerId}
                onSelect={(value) => pushWithOverrides({ partnerId: value })}
              />
            </div>

            <div className="shrink-0 snap-start xl:min-w-[150px] xl:flex-[1.1]">
              <PeriodCombobox
                currentPeriod={currentPeriod}
                currentFrom={currentFrom}
                currentTo={currentTo}
                onSelectPreset={(value) => pushWithOverrides({ period: value, from: null, to: null })}
                onSelectRange={(range) => {
                  const from = range.from ? toYmd(range.from) : null
                  const to = range.to ? toYmd(range.to) : null
                  pushWithOverrides({ period: "custom", from, to })
                }}
              />
            </div>

            <div className="shrink-0 snap-start xl:ml-auto">
              <SortCombobox currentSort={currentSort} onSelect={(value) => pushWithOverrides({ sort: value })} />
            </div>

            <div className="flex shrink-0 snap-start items-center gap-1.5">
              <button
                type="button"
                onClick={() => pushWithOverrides({ view: "grid" })}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors shadow-[var(--shadow-apple)]",
                  currentView === "grid"
                    ? "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--brand-primary)]"
                    : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                )}
                title="Board view"
                aria-label="Board view"
                aria-pressed={currentView === "grid"}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => pushWithOverrides({ view: "list" })}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors shadow-[var(--shadow-apple)]",
                  currentView === "list"
                    ? "border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] text-[var(--brand-primary)]"
                    : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                )}
                title="Table view"
                aria-label="Table view"
                aria-pressed={currentView === "list"}
              >
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          </div>
        </div>
      </FilterBarShell>

      <FilterResultsRow className="justify-between gap-2 px-0 py-0.5 shadow-none">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5 hidescrollbar">
            {activeFilters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.href}
                className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,var(--surface-lowest))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_12%,var(--surface-lowest))] px-2 text-xs font-semibold uppercase tracking-[0.03em] text-[var(--brand-primary)] sm:h-6 sm:text-xs"
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
              className="inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] sm:text-xs"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      </FilterResultsRow>
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
  const isActive = currentSort !== DEFAULT_SORT

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Sort projects" aria-label="Sort projects" className={triggerClassName(isActive, "h-9 w-9 justify-center px-0")}>
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

function PeriodCombobox({
  currentPeriod,
  currentFrom,
  currentTo,
  onSelectPreset,
  onSelectRange,
}: {
  currentPeriod: string
  currentFrom: string
  currentTo: string
  onSelectPreset: (value: string) => void
  onSelectRange: (range: DateRange) => void
}) {
  const [open, setOpen] = React.useState(false)
  const isActive = currentPeriod !== "all_time" || Boolean(currentFrom || currentTo)
  const fromDate = parseMaybeDate(currentFrom)
  const toDate = parseMaybeDate(currentTo)
  const [range, setRange] = React.useState<DateRange | undefined>(
    fromDate || toDate
      ? {
          from: fromDate || undefined,
          to: toDate || undefined,
        }
      : undefined
  )

  React.useEffect(() => {
    const nextFrom = parseMaybeDate(currentFrom)
    const nextTo = parseMaybeDate(currentTo)
    setRange(
      nextFrom || nextTo
        ? {
            from: nextFrom || undefined,
            to: nextTo || undefined,
          }
        : undefined
    )
  }, [currentFrom, currentTo])

  const label = fromDate || toDate
    ? `${fromDate ? format(fromDate, "dd MMM") : "…"} - ${toDate ? format(toDate, "dd MMM") : "…"}`
    : PERIOD_OPTIONS.find((option) => option.value === currentPeriod)?.label || "Period"

  return (
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName(isActive, "w-full justify-between md:min-w-0")}>
          <span className="max-w-[120px] truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-2.5">
        <div className="grid grid-cols-2 gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelectPreset(option.value)
                setOpen(false)
              }}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
                currentPeriod === option.value && !currentFrom && !currentTo
                  ? "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--brand-cyan)_18%,var(--surface-lowest))] text-[var(--brand-primary)]"
                  : "border-[var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="my-3 h-px bg-[var(--line-subtle)]" />

        <Calendar
          mode="range"
          selected={range}
          onSelect={(nextRange) => {
            setRange(nextRange)
            if (nextRange?.from && nextRange?.to) {
              onSelectRange(nextRange)
              setOpen(false)
            }
          }}
          numberOfMonths={1}
          className="rounded-[12px] border border-[var(--line-subtle)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_70%,var(--surface-lowest))]"
        />

        <div className="mt-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onSelectPreset("all_time")
              setOpen(false)
            }}
            className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Clear range
          </button>
          <span className="text-xs font-medium text-[var(--text-secondary)]">Pick start and end date</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TypeCombobox({
  currentRecurring,
  onSelect,
}: {
  currentRecurring: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const isActive = currentRecurring !== "All"

  return (
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName(isActive, "w-full justify-between md:min-w-0")}>
          <span>{RECURRING_OPTIONS.find((option) => option.value === currentRecurring)?.label || "Type"}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-0">
        <Command className="rounded-xl">
          <CommandList>
            <CommandGroup>
              {RECURRING_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded-lg"
                >
                  <Check className={cn("mr-2 h-4 w-4", currentRecurring === option.value ? "opacity-100" : "opacity-0")} />
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

function PartnerCombobox({
  partners,
  currentPartnerId,
  onSelect,
}: {
  partners: { id: string; name: string }[]
  currentPartnerId: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const isActive = currentPartnerId !== "all"
  const selectedPartner = partners.find((partner) => partner.id === currentPartnerId)

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
                  <Check className={cn("mr-2 h-4 w-4", currentPartnerId === partner.id ? "opacity-100" : "opacity-0")} />
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
