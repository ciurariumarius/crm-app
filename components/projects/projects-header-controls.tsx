"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useProjectsSearchContext } from "./projects-search-context"

const STATUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Active", value: "Active" },
  { label: "Pause", value: "Paused" },
  { label: "Done", value: "Completed" },
  { label: "Closed", value: "Closed" },
] as const
const PAYMENT_OPTIONS = ["All", "Paid", "Unpaid"] as const
const TYPE_OPTIONS = [
  { label: "All types", value: "All" },
  { label: "Recurring", value: "Recurring" },
  { label: "One-time", value: "OneTime" },
] as const
const PERIOD_OPTIONS = [
  { label: "All time", value: "all_time" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "This year", value: "this_year" },
  { label: "Last year", value: "last_year" },
  { label: "Custom", value: "custom" },
] as const
const SORT_OPTIONS = [
  { label: "Amount: high to low", value: "amount_desc" },
  { label: "Amount: low to high", value: "amount_asc" },
  { label: "Recently updated", value: "updated_desc" },
  { label: "Newest", value: "created_desc" },
  { label: "Oldest", value: "created_asc" },
  { label: "Name A–Z", value: "name_asc" },
  { label: "Name Z–A", value: "name_desc" },
] as const

type DraftFilters = {
  payment: string
  recurring: string
  partnerId: string
  period: string
  from: string
  to: string
  sort: string
}

const RESET_FILTERS: DraftFilters = {
  payment: "All",
  recurring: "All",
  partnerId: "all",
  period: "all_time",
  from: "",
  to: "",
  sort: "amount_desc",
}

export type ProjectsHeaderFilterProps = {
  partners: { id: string; name: string }[]
  currentStatus: string
  currentPayment: string
  currentRecurring: string
  currentPeriod: string
  currentFrom: string
  currentTo: string
  currentSort: string
  currentProjectId: string
  currentProjectLabel?: string
  currentPartnerId: string
  totalProjects: number
}

function useProjectsHref() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchContext = useProjectsSearchContext()

  return React.useCallback((overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    for (const [key, value] of Object.entries(overrides)) {
      const hasSearch = Boolean(searchContext?.searchTerm.trim() || searchParams.get("q"))
      const isDefault =
        (key === "status" && value === "Active" && !hasSearch) ||
        (key === "payment" && value === "All") ||
        (key === "recurring" && value === "All") ||
        (key === "partnerId" && value === "all") ||
        (key === "period" && value === "all_time") ||
        (key === "sort" && value === "amount_desc") ||
        ((key === "from" || key === "to") && !value)
      if (value === null || isDefault) params.delete(key)
      else params.set(key, value)
    }
    params.delete("page")
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchContext?.searchTerm, searchParams])
}

function activeFilters(props: ProjectsHeaderFilterProps, buildHref: ReturnType<typeof useProjectsHref>) {
  const filters: Array<{ key: string; label: string; href: string }> = []
  const partner = props.partners.find((entry) => entry.id === props.currentPartnerId)
  const type = TYPE_OPTIONS.find((entry) => entry.value === props.currentRecurring)
  const period = PERIOD_OPTIONS.find((entry) => entry.value === props.currentPeriod)
  const sort = SORT_OPTIONS.find((entry) => entry.value === props.currentSort)
  if (props.currentProjectId !== "all") filters.push({ key: "project", label: props.currentProjectLabel || "Selected project", href: buildHref({ projectId: "all" }) })
  if (props.currentPayment !== "All") filters.push({ key: "payment", label: props.currentPayment, href: buildHref({ payment: "All" }) })
  if (props.currentRecurring !== "All") filters.push({ key: "type", label: type?.label || props.currentRecurring, href: buildHref({ recurring: "All" }) })
  if (partner) filters.push({ key: "partner", label: partner.name, href: buildHref({ partnerId: "all" }) })
  if (props.currentPeriod !== "all_time" || props.currentFrom || props.currentTo) {
    filters.push({ key: "period", label: props.currentPeriod === "custom" ? "Custom period" : period?.label || "Period", href: buildHref({ period: "all_time", from: null, to: null }) })
  }
  if (props.currentSort !== "amount_desc") filters.push({ key: "sort", label: sort?.label || "Sort", href: buildHref({ sort: "amount_desc" }) })
  return filters
}

export function ProjectsStatusControls({ currentStatus }: { currentStatus: string }) {
  const buildHref = useProjectsHref()
  const searchContext = useProjectsSearchContext()
  const displayedStatus = searchContext?.searchTerm.trim() && !searchContext.statusRefined
    ? "All"
    : currentStatus
  return (
    <nav className="flex h-9 min-w-0 items-center overflow-x-auto rounded-xl bg-[var(--bg-surface-soft)] p-1 hidescrollbar" aria-label="Project status">
      {STATUS_OPTIONS.map((status) => (
        <Link
          key={status.value}
          href={buildHref({ status: status.value })}
          onClick={() => searchContext?.setStatusRefined(true)}
          aria-current={displayedStatus === status.value ? "page" : undefined}
          className={cn(
            "inline-flex h-7 shrink-0 items-center rounded-lg px-2 text-xs font-semibold uppercase tracking-[0.035em] transition-colors sm:px-3",
            displayedStatus === status.value ? "bg-[var(--brand-primary)] text-white shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          {status.label}
        </Link>
      ))}
    </nav>
  )
}

export function ProjectsFilterControl(props: ProjectsHeaderFilterProps) {
  const router = useRouter()
  const buildHref = useProjectsHref()
  const [desktopOpen, setDesktopOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DraftFilters>(RESET_FILTERS)
  const applied = activeFilters(props, buildHref)

  const currentDraft = React.useCallback((): DraftFilters => ({
    payment: props.currentPayment,
    recurring: props.currentRecurring,
    partnerId: props.currentPartnerId,
    period: props.currentPeriod,
    from: props.currentFrom,
    to: props.currentTo,
    sort: props.currentSort,
  }), [props])

  const setOpen = (target: "desktop" | "mobile", open: boolean) => {
    if (open) setDraft(currentDraft())
    if (target === "desktop") setDesktopOpen(open)
    else setMobileOpen(open)
  }
  const close = () => { setDesktopOpen(false); setMobileOpen(false) }
  const apply = () => {
    router.push(buildHref({ ...draft, from: draft.period === "custom" ? draft.from : null, to: draft.period === "custom" ? draft.to : null }))
    close()
  }
  const trigger = (
    <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-2.5 sm:px-3">
      <SlidersHorizontal className="h-4 w-4" />
      <span className="hidden sm:inline">Filters</span>
      {applied.length ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1.5 text-xs font-bold text-white">{applied.length}</span> : null}
    </Button>
  )
  const panel = <ProjectFiltersPanel draft={draft} setDraft={setDraft} partners={props.partners} onApply={apply} onReset={() => setDraft(RESET_FILTERS)} onCancel={close} />

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <div className="hidden md:block">
        <Popover open={desktopOpen} onOpenChange={(open) => setOpen("desktop", open)}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-[540px] rounded-[16px] p-0">{panel}</PopoverContent>
        </Popover>
      </div>
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={(open) => setOpen("mobile", open)}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[24px] p-0">
            <SheetHeader className="px-5 pb-2 pt-5"><SheetTitle>Project filters</SheetTitle><SheetDescription>Choose filters, then apply them together.</SheetDescription></SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

export function ProjectsActiveFilterChips(props: ProjectsHeaderFilterProps) {
  const buildHref = useProjectsHref()
  const filters = activeFilters(props, buildHref)
  if (!filters.length) return null
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pt-1 hidescrollbar">
      {filters.map((filter) => (
        <Link key={filter.key} href={filter.href} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand-cyan)_30%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_10%,transparent)] px-2.5 text-xs font-semibold text-[var(--brand-primary)]">
          {filter.label}<X className="h-3 w-3" />
        </Link>
      ))}
      <Link href={buildHref({ projectId: "all", payment: "All", recurring: "All", partnerId: "all", period: "all_time", from: null, to: null, sort: "amount_desc" })} className="shrink-0 px-2 text-xs font-semibold text-[var(--text-secondary)]">Clear all</Link>
    </div>
  )
}

function ProjectFiltersPanel({ draft, setDraft, partners, onApply, onReset, onCancel }: {
  draft: DraftFilters
  setDraft: React.Dispatch<React.SetStateAction<DraftFilters>>
  partners: { id: string; name: string }[]
  onApply: () => void
  onReset: () => void
  onCancel: () => void
}) {
  const field = (key: keyof DraftFilters, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect label="Payment" value={draft.payment} onValueChange={(value) => field("payment", value)} options={PAYMENT_OPTIONS.map((value) => ({ label: value, value }))} />
        <FilterSelect label="Type" value={draft.recurring} onValueChange={(value) => field("recurring", value)} options={[...TYPE_OPTIONS]} />
        <FilterSelect label="Partner" value={draft.partnerId} onValueChange={(value) => field("partnerId", value)} options={[{ label: "All partners", value: "all" }, ...partners.map((partner) => ({ label: partner.name, value: partner.id }))]} />
        <FilterSelect label="Period" value={draft.period} onValueChange={(value) => field("period", value)} options={[...PERIOD_OPTIONS]} />
        <div className="sm:col-span-2"><FilterSelect label="Sort" value={draft.sort} onValueChange={(value) => field("sort", value)} options={[...SORT_OPTIONS]} /></div>
        {draft.period === "custom" ? (
          <><label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)]">From<Input type="date" value={draft.from} onChange={(event) => field("from", event.target.value)} className="mt-1.5" /></label><label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)]">To<Input type="date" value={draft.to} onChange={(event) => field("to", event.target.value)} className="mt-1.5" /></label></>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] pt-4">
        <Button type="button" variant="ghost" onClick={onReset}>Reset</Button>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="button" onClick={onApply}>Apply filters</Button></div>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: ReadonlyArray<{ label: string; value: string }> }) {
  return <label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)]">{label}<Select value={value} onValueChange={onValueChange}><SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></label>
}
