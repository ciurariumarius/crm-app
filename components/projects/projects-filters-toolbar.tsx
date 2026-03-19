"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, parseISO } from "date-fns"
import {
    Circle,
    Play,
    CheckCircle2,
    XCircle,
    Wallet,
    AlertCircle,
    Repeat,
    Users,
    CalendarDays,
    ChevronDown,
    ArrowUpDown,
    Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
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
import { useProjectsSearchContext } from "./projects-search-context"

const STATUS_OPTIONS = [
    {
        label: "All",
        value: "All",
        icon: <Circle className="h-2.5 w-2.5 fill-current" />,
        activeClass: "bg-slate-100 text-slate-700",
    },
    {
        label: "Active",
        value: "Active",
        icon: <Play className="h-2.5 w-2.5 fill-current" />,
        activeClass: "bg-blue-100 text-blue-700",
    },
    {
        label: "Paused",
        value: "Paused",
        icon: <Circle className="h-2.5 w-2.5" />,
        activeClass: "bg-amber-100 text-amber-700",
    },
    {
        label: "Completed",
        value: "Completed",
        icon: <CheckCircle2 className="h-3 w-3" />,
        activeClass: "bg-emerald-100 text-emerald-700",
    },
    {
        label: "Closed",
        value: "Closed",
        icon: <XCircle className="h-3 w-3" />,
        activeClass: "bg-slate-200 text-slate-700",
    },
]

const PAYMENT_OPTIONS = [
    { label: "All", value: "All", icon: <Wallet className="h-3 w-3" />, activeClass: "bg-slate-100 text-slate-700" },
    { label: "Paid", value: "Paid", icon: <CheckCircle2 className="h-3 w-3" />, activeClass: "bg-emerald-100 text-emerald-700" },
    { label: "Unpaid", value: "Unpaid", icon: <AlertCircle className="h-3 w-3" />, activeClass: "bg-rose-100 text-rose-700" },
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

function toYmd(value: Date) {
    return format(value, "yyyy-MM-dd")
}

function parseMaybeDate(value: string | null | undefined) {
    if (!value) return null
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
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
    currentPartnerId,
    totalProjects,
}: {
    partners: { id: string; name: string }[]
    currentStatus: string
    currentPayment: string
    currentRecurring: string
    currentPeriod: string
    currentFrom: string
    currentTo: string
    currentSort: string
    currentPartnerId: string
    totalProjects: number
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const searchContext = useProjectsSearchContext()

    const buildHref = (overrides: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(overrides).forEach(([key, value]) => {
            const isDefaultStatus = key === "status" && value === "Active"
            const isDefaultPayment = key === "payment" && value === "All"
            const isDefaultRecurring = key === "recurring" && value === "All"
            const isDefaultPeriod = key === "period" && value === "all_time"
            const isDefaultSort = key === "sort" && value === "updated_desc"
            const isDefaultPartner = key === "partnerId" && value === "all"
            const isDefaultFrom = key === "from" && !value
            const isDefaultTo = key === "to" && !value

            if (
                value === null ||
                isDefaultStatus ||
                isDefaultPayment ||
                isDefaultRecurring ||
                isDefaultPeriod ||
                isDefaultSort ||
                isDefaultPartner ||
                isDefaultFrom ||
                isDefaultTo
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
    const selectedSort = SORT_OPTIONS.find((option) => option.value === currentSort) ?? SORT_OPTIONS[0]
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
    if (currentPartnerId !== "all" && selectedPartner) activeFilters.push({ key: "partnerId", label: `Partner: ${selectedPartner.name}`, href: buildHref({ partnerId: "all" }) })
    if (hasCustomRange) activeFilters.push({ key: "period_custom", label: `Period: ${customRangeLabel}`, href: buildHref({ period: "all_time", from: null, to: null }) })
    if (!hasCustomRange && currentPeriod !== "all_time") activeFilters.push({ key: "period", label: `Period: ${selectedPeriod.label}`, href: buildHref({ period: "all_time", from: null, to: null }) })
    if (currentSort !== "updated_desc") activeFilters.push({ key: "sort", label: `Sort: ${selectedSort.label}`, href: buildHref({ sort: "updated_desc" }) })

    const clearAllHref = buildHref({
        status: "Active",
        payment: "All",
        recurring: "All",
        partnerId: null,
        period: "all_time",
        from: null,
        to: null,
        sort: "updated_desc",
    })
    const hasSearchTerm = Boolean(searchContext?.searchTerm.trim())
    const searchResultCount = searchContext?.searchResultCount
    const displayTotal = hasSearchTerm && searchResultCount !== null && searchResultCount !== undefined
        ? searchResultCount
        : totalProjects

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="overflow-x-auto hidescrollbar">
                    <div className="inline-flex min-w-max items-center gap-4 md:flex md:w-full md:min-w-0 md:items-center md:gap-6">
                        <div className="inline-flex items-center gap-4 md:gap-5">
                            <div className="inline-flex h-10 items-center gap-1">
                                {STATUS_OPTIONS.map((option) => (
                                    <Link
                                        key={option.value}
                                        href={buildHref({ status: option.value })}
                                        className={cn(
                                            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                                            currentStatus === option.value
                                                ? option.activeClass
                                                : "text-slate-600 hover:text-slate-800"
                                        )}
                                    >
                                        {option.icon}
                                        {option.label}
                                    </Link>
                                ))}
                            </div>

                            <div className="h-6 w-px bg-slate-200 md:mx-1" />

                            <div className="inline-flex h-10 items-center gap-1">
                                {PAYMENT_OPTIONS.map((option) => (
                                    <Link
                                        key={option.value}
                                        href={buildHref({ payment: option.value })}
                                        className={cn(
                                            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                                            currentPayment === option.value
                                                ? option.activeClass
                                                : "text-slate-600 hover:text-slate-800"
                                        )}
                                    >
                                        {option.icon}
                                        {option.label}
                                    </Link>
                                ))}
                            </div>

                            <div className="h-6 w-px bg-slate-200 md:mx-1" />

                            <TypeCombobox
                                currentRecurring={currentRecurring}
                                onSelect={(value) => {
                                    pushWithOverrides({ recurring: value })
                                }}
                            />
                        </div>

                        <div className="h-6 w-px bg-slate-200 md:mx-1" />

                        <PartnerCombobox
                            partners={partners}
                            currentPartnerId={currentPartnerId}
                            onSelect={(value) => {
                                pushWithOverrides({ partnerId: value })
                            }}
                        />

                        <PeriodCombobox
                            currentPeriod={currentPeriod}
                            currentFrom={currentFrom}
                            currentTo={currentTo}
                            onSelectPreset={(value) => {
                                pushWithOverrides({ period: value, from: null, to: null })
                            }}
                            onSelectRange={(range) => {
                                const from = range.from ? toYmd(range.from) : null
                                const to = range.to ? toYmd(range.to) : null
                                pushWithOverrides({ period: "custom", from, to })
                            }}
                        />

                        <div className="h-6 w-px bg-slate-200 md:ml-auto md:mr-1" />

                        <SortCombobox
                            currentSort={currentSort}
                            onSelect={(value) => {
                                pushWithOverrides({ sort: value })
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="px-1 flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-medium text-slate-600">
                    {searchContext?.isSearching ? "Searching..." : `${displayTotal} Results found`}
                </p>
                {activeFilters.length > 0 && <span className="text-slate-300">|</span>}
                {activeFilters.map((filter) => (
                    <Link
                        key={filter.key}
                        href={filter.href}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                        <span>{filter.label}</span>
                    </Link>
                ))}
                {activeFilters.length > 0 && (
                    <Link
                        href={clearAllHref}
                        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                        Clear all
                    </Link>
                )}
            </div>
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
    const isActive = currentSort !== "updated_desc"
    const selectedSort = SORT_OPTIONS.find((option) => option.value === currentSort) ?? SORT_OPTIONS[0]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={`Sort: ${selectedSort.label}`}
                    aria-label={`Sort: ${selectedSort.label}`}
                    className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <ArrowUpDown className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
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
        : (PERIOD_OPTIONS.find((option) => option.value === currentPeriod)?.label || "Period")

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <CalendarDays className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[140px] truncate">{label}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
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
                                "inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
                                currentPeriod === option.value && !currentFrom && !currentTo
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="my-3 h-px bg-slate-200" />

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
                    className="rounded-xl border border-slate-100 bg-slate-50/50"
                />

                <div className="mt-3 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            onSelectPreset("all_time")
                            setOpen(false)
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                        Clear range
                    </button>
                    <span className="text-[11px] font-medium text-slate-500">
                        Pick start and end date
                    </span>
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
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <Repeat className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span>Type</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[220px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
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
                <button
                    type="button"
                    className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all",
                        isActive
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    )}
                >
                    <Users className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                    <span className="max-w-[180px] truncate">{selectedPartner?.name || "Partner"}</span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[320px] rounded-xl border border-slate-200 bg-white p-0 shadow-xl">
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
                                <Check className={cn("mr-2 h-4 w-4", currentPartnerId === "all" ? "opacity-100" : "opacity-0")} />
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
