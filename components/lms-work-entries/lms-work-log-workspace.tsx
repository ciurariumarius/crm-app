"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, isWeekend, parseISO, startOfMonth, subDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Download,
  FileSpreadsheet,
  ListFilter,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import {
  createLmsWorkClient,
  createLmsWorkEntry,
  deleteLmsWorkEntry,
  getLmsWorkComposerContext,
  updateLmsWorkEntry,
} from "@/lib/actions/lms-work-entries"
import { getLmsDatePresets, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { matchesLmsClientSearch } from "@/lib/lms-work-entries/client-search"
import {
  addDateOnlyDays,
  addLmsWorkdays,
  getDefaultLmsWorkDate,
  getLmsWorkCapacity,
  getLmsWorkWeekDates,
} from "@/lib/lms-work-entries/date"
import {
  LMS_WORK_DURATION_PRESETS,
  formatCompactLmsWorkDuration,
  getLmsWorkDefaultDurationSelection,
  getLmsWorkUtilizationPercent,
  isLmsWorkDurationPreset,
  parseCustomLmsWorkDuration,
} from "@/lib/lms-work-entries/duration-options"
import { LMS_WORK_LOG_PAGE_SIZES } from "@/lib/lms-work-entries/pagination"
import type {
  LmsWorkComposerContext,
  LmsWorkEntryInput,
  LmsWorkEntryRow,
  LmsWorkClientOption,
  LmsWorkLogPageData,
  LmsWorkTaskOption,
} from "@/lib/lms-work-entries/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const CUSTOM_PERIOD = "custom"
const CUSTOM_DURATION_VALUE = "custom"
const EXPORT_STATUS_FILTER_OPTIONS = [
  { id: "not-exported", label: "Not exported" },
  { id: "exported", label: "Exported" },
]

function localToday() {
  return format(new Date(), "yyyy-MM-dd")
}

function formatEntryDate(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, "dd MMM yyyy") : value
}

function formatEntryDateSpan(first: string | null, last: string | null) {
  if (!first || !last) return "—"
  if (first === last) return formatEntryDate(first)
  return `${formatEntryDate(first)} – ${formatEntryDate(last)}`
}

function isSelectableWorkDate(value: string) {
  if (!value) return false
  const parsed = parseISO(value)
  return isValid(parsed) && !isWeekend(parsed)
}

function WorkDatePicker({
  id,
  value,
  onValueChange,
  ariaLabel,
  className,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [today, setToday] = React.useState("")
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : undefined
  }, [value])

  React.useEffect(() => {
    setToday(localToday())
  }, [])

  function chooseDate(date: Date | undefined) {
    if (!date || isWeekend(date)) return
    onValueChange(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn("h-14 w-full justify-between rounded-xl px-4 text-left font-medium", className)}
        >
          <span className="flex min-w-0 items-center gap-3">
            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="truncate">{selectedDate ? formatEntryDate(value) : "Choose a date"}</span>
              {selectedDate ? (
                <span className="mt-1 text-xs font-normal text-[var(--text-muted)]">
                  {format(selectedDate, "EEEE")}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(92vw,420px)] overflow-hidden rounded-2xl p-0"
      >
        <div className="w-full p-4 [&_[data-slot=calendar]]:![--cell-size:clamp(40px,11vw,48px)] [&_.rdp-month_grid]:!w-full [&_.rdp-weeks]:!w-full">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            disabled={isWeekend}
            onSelect={chooseDate}
            initialFocus
            className="w-full bg-transparent p-0"
            classNames={{
              root: "w-full",
              month: "w-full",
              months: "w-full",
              month_grid: "w-full table-fixed",
              weekdays: "grid w-full grid-cols-7",
              weekday: "text-sm font-medium",
              week: "mt-2 grid w-full grid-cols-7",
              day: "w-full",
              day_button: "text-base font-medium",
              caption_label: "text-base font-semibold",
            }}
          />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-4 py-3">
          <span className="text-xs text-[var(--text-muted)]">Monday–Friday</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!today}
            onClick={() => {
              onValueChange(getDefaultLmsWorkDate(today))
              setOpen(false)
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatWorkWeekLabel(dates: string[]) {
  const first = parseISO(dates[0])
  const last = parseISO(dates[dates.length - 1])
  if (!isValid(first) || !isValid(last)) return "Work week"
  if (format(first, "yyyy-MM") === format(last, "yyyy-MM")) {
    return `${format(first, "d")}–${format(last, "d MMM yyyy")}`.toUpperCase()
  }
  return `${format(first, "d MMM")}–${format(last, "d MMM yyyy")}`.toUpperCase()
}

function formatSelectedWorkDate(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, "EEE · d MMM").toUpperCase() : "CHOOSE DATE"
}

function formatSaveWorkDate(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, "d MMM") : "date"
}

function WorkWeekNavigator({
  selectedDate,
  today,
  context,
  loading,
  onSelectDate,
}: {
  selectedDate: string
  today: string
  context: LmsWorkComposerContext
  loading: boolean
  onSelectDate: (value: string) => void
}) {
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const weekDates = React.useMemo(() => getLmsWorkWeekDates(selectedDate), [selectedDate])
  const contextMatchesWeek = context.weekStart === weekDates[0]
  const totalsByDate = React.useMemo(
    () => new Map(context.days.map((day) => [day.date, day.totalMinutes])),
    [context.days]
  )
  const selected = parseISO(selectedDate)

  function chooseDate(value: string, focus = false) {
    if (!isSelectableWorkDate(value)) return
    onSelectDate(value)
    if (focus) {
      window.requestAnimationFrame(() => {
        rootRef.current?.querySelector<HTMLElement>(`[data-work-date="${value}"]`)?.focus()
      })
    }
  }

  function chooseCalendarDate(date: Date | undefined) {
    if (!date || isWeekend(date)) return
    chooseDate(format(date, "yyyy-MM-dd"), true)
    setCalendarOpen(false)
  }

  return (
    <div ref={rootRef} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-2.5 sm:p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous work week"
            onClick={() => chooseDate(addDateOnlyDays(selectedDate, -7), true)}
          >
            <ChevronLeft />
          </Button>
          <p className="min-w-40 text-center text-sm font-semibold tracking-wide text-[var(--text-primary)]">
            {formatWorkWeekLabel(weekDates)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next work week"
            onClick={() => chooseDate(addDateOnlyDays(selectedDate, 7), true)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!today}
            onClick={() => chooseDate(getDefaultLmsWorkDate(today), true)}
            className="h-8 px-2.5 text-xs"
          >
            Today
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" aria-label="Choose work date">
                <CalendarDays className="h-3.5 w-3.5" />
                Calendar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-auto rounded-2xl p-3">
              <Calendar
                mode="single"
                selected={isValid(selected) ? selected : undefined}
                defaultMonth={isValid(selected) ? selected : undefined}
                disabled={isWeekend}
                onSelect={chooseCalendarDate}
                initialFocus
              />
              <p className="border-t border-[var(--line-subtle)] pt-2 text-center text-xs text-[var(--text-muted)]">
                Monday–Friday
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Work date">
        {weekDates.map((date) => {
          const parsed = parseISO(date)
          const isSelected = date === selectedDate
          const showLoading = loading && !contextMatchesWeek
          return (
            <button
              key={date}
              type="button"
              data-work-date={date}
              tabIndex={isSelected ? 0 : -1}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${format(parsed, "EEEE d MMMM")}, ${formatCompactLmsWorkDuration(totalsByDate.get(date) ?? 0)} logged`}
              onClick={() => chooseDate(date)}
              onKeyDown={(event) => {
                let nextDate: string | null = null
                if (event.key === "ArrowLeft") nextDate = addLmsWorkdays(date, -1)
                if (event.key === "ArrowRight") nextDate = addLmsWorkdays(date, 1)
                if (event.key === "Home") nextDate = weekDates[0]
                if (event.key === "End") nextDate = weekDates[weekDates.length - 1]
                if (!nextDate) return
                event.preventDefault()
                chooseDate(nextDate, true)
              }}
              className={cn(
                "min-w-0 rounded-lg border px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2",
                isSelected
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-sm"
                  : "border-transparent bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-low)]"
              )}
            >
              <span className={cn("block text-[10px] font-bold tracking-[0.08em]", isSelected ? "text-white" : "text-[var(--text-muted)]")}>
                {format(parsed, "EEE").toUpperCase()}
              </span>
              <span className="mt-0.5 block text-sm font-bold">{format(parsed, "d")}</span>
              <span className={cn("mt-0.5 block text-[11px] font-semibold", isSelected ? "text-white/90" : "text-[var(--text-muted)]")}>
                {showLoading ? "…" : formatCompactLmsWorkDuration(totalsByDate.get(date) ?? 0)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WorkEntryCustomRangePicker({
  open,
  onOpenChange,
  from,
  to,
  onRangeChange,
  onApply,
  onCancel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  from: string
  to: string
  onRangeChange: (from: string, to: string) => void
  onApply: () => void
  onCancel: () => void
}) {
  const [calendarMonths, setCalendarMonths] = React.useState(1)
  const selectedRange = React.useMemo<DateRange | undefined>(() => {
    const parsedFrom = from ? parseISO(from) : undefined
    const parsedTo = to ? parseISO(to) : undefined
    return parsedFrom && isValid(parsedFrom)
      ? { from: parsedFrom, to: parsedTo && isValid(parsedTo) ? parsedTo : undefined }
      : undefined
  }, [from, to])
  const rangeLabel = from && to
    ? `${formatEntryDate(from)} – ${formatEntryDate(to)}`
    : from ? `${formatEntryDate(from)} – choose end` : "Choose start and end"

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const updateMonthCount = () => setCalendarMonths(media.matches ? 2 : 1)
    updateMonthCount()
    media.addEventListener("change", updateMonthCount)
    return () => media.removeEventListener("change", updateMonthCount)
  }, [])

  function selectRange(range: DateRange | undefined) {
    onRangeChange(
      range?.from ? format(range.from, "yyyy-MM-dd") : "",
      range?.to ? format(range.to, "yyyy-MM-dd") : ""
    )
  }

  function selectQuickRange(kind: "today" | "seven-days" | "this-month") {
    const today = new Date()
    const start = kind === "today"
      ? today
      : kind === "seven-days" ? subDays(today, 6) : startOfMonth(today)
    onRangeChange(format(start, "yyyy-MM-dd"), format(today, "yyyy-MM-dd"))
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Choose custom date range"
          aria-expanded={open}
          className="h-9 w-full justify-between gap-2 rounded-lg px-3 text-sm font-medium sm:w-auto sm:min-w-56"
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
            <span className="truncate">{rangeLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="max-h-[min(88vh,760px)] w-[min(94vw,760px)] overflow-y-auto rounded-2xl border-[var(--line-subtle)] p-0 shadow-xl"
      >
        <div className="border-b border-[var(--line-subtle)] px-4 py-3">
          <p className="font-semibold text-[var(--text-primary)]">Custom date range</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {from && !to ? "Now choose the end date." : "Choose a start date and an end date."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => selectQuickRange("today")}>Today</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => selectQuickRange("seven-days")}>Last 7 days</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => selectQuickRange("this-month")}>This month</Button>
        </div>
        <div className="w-full p-4 [&_[data-slot=calendar]]:![--cell-size:clamp(36px,8vw,44px)] [&_.rdp-month_grid]:!w-full [&_.rdp-weeks]:!w-full">
          <Calendar
            mode="range"
            selected={selectedRange}
            defaultMonth={selectedRange?.from}
            onSelect={selectRange}
            numberOfMonths={calendarMonths}
            fixedWeeks
            initialFocus
            className="w-full bg-transparent p-0"
            classNames={{
              root: "w-full",
              months: "grid w-full gap-5 md:grid-cols-2",
              month: "w-full",
              month_grid: "w-full table-fixed",
              weekdays: "grid w-full grid-cols-7",
              weekday: "text-sm font-medium",
              week: "mt-2 grid w-full grid-cols-7",
              day: "w-full",
              day_button: "text-sm font-medium",
              caption_label: "text-base font-semibold",
            }}
          />
        </div>
        <div className="flex flex-col gap-3 border-t border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 truncate text-sm font-medium text-[var(--text-secondary)]">{rangeLabel}</span>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button type="button" size="sm" onClick={onApply} disabled={!from || !to}>Apply range</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatMinutes(value: number) {
  if (value < 60) return `${value}m`
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

function formatExportedAt(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, "dd MMM yyyy, HH:mm") : value
}

function ExportStatusBadge({ exportedAt }: { exportedAt: string | null }) {
  if (!exportedAt) {
    return (
      <Badge variant="outline" className="text-[var(--text-muted)]">
        Not exported
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
      title={`Exported ${formatExportedAt(exportedAt)}`}
    >
      <CheckCircle2 />
      Exported
    </Badge>
  )
}

function getDownloadFilename(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/i)
  return match?.[1] || "TASK_IMPORT.xlsx"
}

async function downloadExportResponse(response: Response, fallbackCount: number) {
  const exportedCount = Number(response.headers.get("x-exported-entry-count")) || fallbackCount
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = getDownloadFilename(response.headers.get("content-disposition"))
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
  return exportedCount
}

function WorkEntryFilterCombobox({
  ariaLabel,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  unavailableLabel,
  options,
  value,
  onValueChange,
  selectedValueLabel,
  triggerLabel,
  fullWidth,
  allValue = "",
}: {
  ariaLabel: string
  allLabel: string
  searchPlaceholder: string
  emptyLabel: string
  unavailableLabel: string
  options: Array<{ id: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  selectedValueLabel?: string
  triggerLabel?: string
  fullWidth?: boolean
  allValue?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const selected = options.find((option) => option.id === value)
  const listboxId = React.useId()
  const filteredOptions = React.useMemo(
    () => options.filter((option) => matchesLmsClientSearch(option.label, search)),
    [options, search]
  )
  const hasActiveFilter = value !== allValue

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={triggerLabel ? "ghost" : "outline"}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          title={selected?.label ?? selectedValueLabel ?? allLabel}
          className={cn(
            "justify-between gap-2",
            triggerLabel
              ? "-ml-2 h-8 px-2 text-xs font-semibold uppercase tracking-[0.08em]"
              : "w-full px-3 font-normal",
            !triggerLabel && !fullWidth && "sm:w-52",
            hasActiveFilter && triggerLabel && "text-[var(--brand-primary)]"
          )}
        >
          <span className="truncate">
            {triggerLabel ?? selected?.label ?? selectedValueLabel ?? (value ? unavailableLabel : allLabel)}
          </span>
          {triggerLabel ? (
            <ListFilter className={cn("h-3.5 w-3.5 shrink-0", hasActiveFilter ? "opacity-100" : "opacity-55")} />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[min(92vw,520px)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList id={listboxId} aria-label={ariaLabel} className="max-h-[320px]">
            <CommandItem
              value={allLabel}
              aria-current={value === allValue}
              onSelect={() => {
                onValueChange(allValue)
                changeOpen(false)
              }}
              className={cn(value === allValue && "bg-[var(--bg-surface-soft)]")}
            >
              <Check className={cn("mr-2 h-4 w-4 shrink-0", value === allValue ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{allLabel}</span>
            </CommandItem>
            {filteredOptions.length === 0 ? <CommandEmpty>{emptyLabel}</CommandEmpty> : null}
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.id}
                value={`${option.label} ${option.id}`}
                aria-current={value === option.id}
                onSelect={() => {
                  onValueChange(option.id)
                  changeOpen(false)
                }}
                className={cn(value === option.id && "bg-[var(--bg-surface-soft)]")}
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === option.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ClientCombobox({
  clients,
  value,
  onValueChange,
  onCreateRequest,
  disabled,
  large,
}: {
  clients: LmsWorkClientOption[]
  value: string
  onValueChange: (value: string) => void
  onCreateRequest?: (suggestedName: string) => void
  disabled?: boolean
  large?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const selectedClient = clients.find((client) => client.id === value)
  const listboxId = React.useId()
  const filteredClients = React.useMemo(
    () => clients.filter((client) => matchesLmsClientSearch(client.client, search)),
    [clients, search]
  )
  const hasSelection = Boolean(selectedClient)

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label="Select LMS client"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              changeOpen(true)
            }
          }}
          className={cn(
            "w-full justify-between gap-3 px-3 text-left font-normal",
            hasSelection && "border-[color:color-mix(in_srgb,var(--brand-primary)_58%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary-container)_10%,var(--surface-lowest))] font-medium text-[var(--text-primary)]",
            large && "h-12 px-4 text-sm"
          )}
          disabled={disabled || (clients.length === 0 && !onCreateRequest)}
        >
          <span className={cn("min-w-0 flex-1 truncate", !hasSelection && "text-[var(--text-muted)]")}>
            {selectedClient?.client
              ?? (clients.length ? "Select LMS client" : onCreateRequest ? "Add first LMS client" : "No LMS clients imported")}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {hasSelection ? <CheckCircle2 className="h-4 w-4 text-[var(--brand-primary)]" /> : null}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[min(92vw,560px)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            placeholder="Search clients..."
            value={search}
            onValueChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                changeOpen(false)
              }
            }}
          />
          <CommandList id={listboxId} aria-label="LMS clients" className="max-h-[320px]">
            {filteredClients.length === 0 ? <CommandEmpty>No LMS client found.</CommandEmpty> : null}
            {filteredClients.map((client) => (
              <CommandItem
                key={client.id}
                value={`${client.client} ${client.id}`}
                aria-current={value === client.id}
                onSelect={() => {
                  onValueChange(client.id)
                  changeOpen(false)
                }}
                className={cn("py-2.5", value === client.id && "bg-[var(--bg-surface-soft)]")}
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === client.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{client.client}</span>
              </CommandItem>
            ))}
            {onCreateRequest ? (
              <CommandItem
                value={`add-client ${search}`}
                onSelect={() => {
                  const suggestedName = search.trim()
                  changeOpen(false)
                  onCreateRequest(suggestedName)
                }}
                className="border-t border-[var(--line-subtle)] py-2.5 text-[var(--brand-primary)]"
              >
                <UserPlus className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {search.trim() ? `Use or add “${search.trim()}”` : "Add a new LMS client"}
                </span>
              </CommandItem>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function TaskCombobox({
  tasks,
  value,
  onValueChange,
  disabled,
  large,
  triggerRef,
}: {
  tasks: LmsWorkTaskOption[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  large?: boolean
  triggerRef?: React.Ref<HTMLButtonElement>
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const options = React.useMemo(() => tasks.filter((task) => task.isActive), [tasks])
  const selectedTask = options.find((task) => task.id === value)
  const listboxId = React.useId()
  const filteredTasks = React.useMemo(
    () => options.filter((task) => matchesLmsClientSearch(task.name, search)),
    [options, search]
  )
  const hasSelection = Boolean(selectedTask)

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label="Select predefined task"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              changeOpen(true)
            }
          }}
          className={cn(
            "w-full justify-between gap-3 rounded-xl px-4 text-left text-sm font-normal",
            large ? "h-12 text-sm" : "h-12",
            hasSelection && "border-[color:color-mix(in_srgb,var(--brand-primary)_58%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary-container)_10%,var(--surface-lowest))] font-medium text-[var(--text-primary)]"
          )}
          disabled={disabled || options.length === 0}
        >
          <span className={cn("min-w-0 flex-1 truncate", !hasSelection && "text-[var(--text-muted)]")}>
            {selectedTask?.name ?? (options.length ? "Select predefined task" : "Add a task first")}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {hasSelection ? <CheckCircle2 className="h-4 w-4 text-[var(--brand-primary)]" /> : null}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[min(92vw,560px)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            autoFocus
            placeholder="Search tasks..."
            value={search}
            onValueChange={setSearch}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                changeOpen(false)
              }
            }}
          />
          <CommandList id={listboxId} aria-label="Predefined tasks" className="max-h-[280px]">
            {filteredTasks.length === 0 ? <CommandEmpty>No work-entry task found.</CommandEmpty> : null}
            {filteredTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={`${task.name} ${task.id}`}
                aria-current={value === task.id}
                onSelect={() => {
                  onValueChange(task.id)
                  changeOpen(false)
                }}
                className={cn("py-2.5", value === task.id && "bg-[var(--bg-surface-soft)]")}
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === task.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{task.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function FrequentWorkOptions({
  ariaLabel,
  options,
  value,
  onValueChange,
  twoRows,
}: {
  ariaLabel: string
  options: Array<{ id: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  twoRows?: boolean
}) {
  if (options.length === 0) return null

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={twoRows
        ? "grid grid-cols-3 gap-1.5"
        : "flex gap-1.5 overflow-x-auto pb-1"}
    >
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant={value === option.id ? "default" : "outline"}
          aria-pressed={value === option.id}
          title={option.label}
          onClick={() => onValueChange(option.id)}
          className={cn(
            "h-9 rounded-lg px-2 text-xs font-semibold",
            twoRows ? "min-w-0 w-full" : "min-w-32 max-w-48 flex-1 shrink-0"
          )}
        >
          <span className="truncate">{option.label}</span>
        </Button>
      ))}
    </div>
  )
}

function TaskSelect({
  tasks,
  value,
  onValueChange,
  currentTaskId,
  disabled,
  large,
}: {
  tasks: LmsWorkTaskOption[]
  value: string
  onValueChange: (value: string) => void
  currentTaskId?: string
  disabled?: boolean
  large?: boolean
}) {
  const options = tasks.filter((task) => task.isActive || task.id === currentTaskId)
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", large && "h-12! px-4 text-sm")}>
        <SelectValue placeholder={options.length ? "Select predefined task" : "Add a task first"} />
      </SelectTrigger>
      <SelectContent align="start" className="max-w-[min(92vw,520px)]">
        {options.map((task) => (
          <SelectItem key={task.id} value={task.id}>
            {task.name}{task.isActive ? "" : " (inactive)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EditEntryDialog({
  entry,
  clients,
  tasks,
  onClose,
}: {
  entry: LmsWorkEntryRow | null
  clients: LmsWorkClientOption[]
  tasks: LmsWorkTaskOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [lmsAllocationId, setLmsAllocationId] = React.useState("")
  const [taskTypeId, setTaskTypeId] = React.useState("")
  const [workDate, setWorkDate] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!entry) return
    setLmsAllocationId(
      entry.lmsAllocationId && clients.some((client) => client.id === entry.lmsAllocationId)
        ? entry.lmsAllocationId
        : ""
    )
    setTaskTypeId(entry.taskTypeId)
    setWorkDate(entry.workDate)
    setMinutes(String(entry.durationMinutes))
  }, [clients, entry])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!entry) return
    const durationMinutes = Number(minutes)
    const canPreserveDetachedClient = entry.lmsAllocationId === null && !lmsAllocationId
    if ((!lmsAllocationId && !canPreserveDetachedClient) || !taskTypeId || !workDate || !Number.isInteger(durationMinutes) || durationMinutes < 1) {
      toast.error("Complete all fields with valid values")
      return
    }
    setSaving(true)
    const result = await updateLmsWorkEntry(entry.id, {
      lmsAllocationId: lmsAllocationId || null,
      taskTypeId,
      workDate,
      durationMinutes,
    })
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(entry.exportedAt ? "Work entry updated and marked for re-export" : "Work entry updated")
    onClose()
    router.refresh()
  }

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit work entry</DialogTitle>
          <DialogDescription>Client and task snapshots change only when you select a different value.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-work-date">Date</Label>
            <WorkDatePicker
              id="edit-work-date"
              value={workDate}
              onValueChange={setWorkDate}
              ariaLabel="Edit work date"
            />
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <ClientCombobox clients={clients} value={lmsAllocationId} onValueChange={setLmsAllocationId} />
            {entry?.lmsAllocationId === null && !lmsAllocationId ? (
              <p className="text-xs text-amber-700">
                {entry.clientDomain} is no longer in LMS Projects. You can keep this historical client or select a current one.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Task</Label>
            <TaskSelect tasks={tasks} value={taskTypeId} onValueChange={setTaskTypeId} currentTaskId={entry?.taskTypeId} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-work-minutes">Minutes</Label>
            <Input id="edit-work-minutes" type="number" min={1} max={1440} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddClientDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: LmsWorkClientOption) => void
  initialName?: string
}) {
  const [name, setName] = React.useState(initialName)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) setName(initialName)
  }, [initialName, open])

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen && !saving) setName("")
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    const result = await createLmsWorkClient(name)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }

    onCreated(result.client)
    setName("")
    onOpenChange(false)
    toast.success(result.existed ? "Existing client selected" : "Client added and selected")
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>
            Enter the LMS client name or domain. If it already exists, it will be selected instead of duplicated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-lms-client">Client name or domain</Label>
            <Input
              id="new-lms-client"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="example.ro"
              maxLength={255}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
              {saving ? "Adding…" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LmsWorkLogWorkspace({
  data,
  activePeriod,
  initialComposerContext,
}: {
  data: LmsWorkLogPageData
  activePeriod: string
  initialComposerContext: LmsWorkComposerContext
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [today, setToday] = React.useState("")
  const [workDate, setWorkDate] = React.useState(initialComposerContext.selectedDate)
  const [composerContext, setComposerContext] = React.useState(initialComposerContext)
  const [composerContextLoading, setComposerContextLoading] = React.useState(false)
  const [clientOptions, setClientOptions] = React.useState(data.clients)
  const [lmsAllocationId, setLmsAllocationId] = React.useState("")
  const [addClientOpen, setAddClientOpen] = React.useState(false)
  const [addClientInitialName, setAddClientInitialName] = React.useState("")
  const [taskTypeId, setTaskTypeId] = React.useState("")
  const [durationSelection, setDurationSelection] = React.useState("")
  const [customMinutes, setCustomMinutes] = React.useState("")
  const [customMinutesTouched, setCustomMinutesTouched] = React.useState(false)
  const [formAttempted, setFormAttempted] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [exportingSelected, setExportingSelected] = React.useState(false)
  const [exportAll, setExportAll] = React.useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = React.useState<string[]>([])
  const [editingEntry, setEditingEntry] = React.useState<LmsWorkEntryRow | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState(activePeriod)
  const [customFrom, setCustomFrom] = React.useState(data.from || "")
  const [customTo, setCustomTo] = React.useState(data.to || "")
  const [customRangeOpen, setCustomRangeOpen] = React.useState(false)
  const customMinutesRef = React.useRef<HTMLInputElement | null>(null)
  const taskTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const composerRequestRef = React.useRef(0)
  const presets = React.useMemo(() => getLmsDatePresets(), [])
  const selectedPeriodName = period === CUSTOM_PERIOD
    ? "Custom"
    : presets.find((preset) => preset.id === period)?.label || "All Time"
  const matchingTaskDateSpan = data.firstWorkDate && data.lastWorkDate
    ? formatEntryDateSpan(data.firstWorkDate, data.lastWorkDate)
    : "no tasks"
  const periodDisplayLabel = `${selectedPeriodName} (${matchingTaskDateSpan})`
  const activeTasks = data.tasks.filter((task) => task.isActive)
  const internalClient = clientOptions.find(
    (client) => client.client.trim().toLocaleLowerCase("ro") === "[intern]"
  )
  const frequentClientOptions = [
    ...(internalClient ? [internalClient] : []),
    ...data.frequentClients
      .filter(
        (client) => client.id !== internalClient?.id
          && clientOptions.some((option) => option.id === client.id)
      )
      .slice(0, internalClient ? 5 : 6),
  ]
  const hasSelectedClient = clientOptions.some((client) => client.id === lmsAllocationId)
  const hasSelectedTask = activeTasks.some((task) => task.id === taskTypeId)
  const customDurationEnabled = durationSelection === CUSTOM_DURATION_VALUE
  const selectedPresetMinutes = Number(durationSelection)
  const durationMinutes = customDurationEnabled
    ? parseCustomLmsWorkDuration(customMinutes)
    : isLmsWorkDurationPreset(selectedPresetMinutes) ? selectedPresetMinutes : null
  const customDurationInvalid = customDurationEnabled && durationMinutes === null
  const effectiveWorkDate = isSelectableWorkDate(workDate) ? workDate : ""
  const selectedDayTotal = composerContext.days.find((day) => day.date === workDate)?.totalMinutes ?? 0
  const composerCanSubmit = Boolean(
    effectiveWorkDate
    && hasSelectedClient
    && hasSelectedTask
    && clientOptions.length > 0
    && activeTasks.length > 0
    && durationMinutes !== null
  )
  const workCapacity = React.useMemo(() => getLmsWorkCapacity(data.from, data.to), [data.from, data.to])
  const workUtilizationPercent = workCapacity
    ? getLmsWorkUtilizationPercent(data.totalMinutes, workCapacity.hours)
    : null
  const firstVisibleEntry = data.totalEntries === 0 ? 0 : (data.page - 1) * data.pageSize + 1
  const lastVisibleEntry = Math.min(data.page * data.pageSize, data.totalEntries)
  const exportAllEntryCount = data.exportStatus === "not-exported"
    ? data.allMatchingEntries
    : data.totalEntries
  const selectedEntryIdSet = React.useMemo(() => new Set(selectedEntryIds), [selectedEntryIds])
  const allVisibleEntriesSelected = data.entries.length > 0
    && data.entries.every((entry) => selectedEntryIdSet.has(entry.id))
  const someVisibleEntriesSelected = data.entries.some((entry) => selectedEntryIdSet.has(entry.id))
  const exportBusy = exporting || exportingSelected

  React.useEffect(() => {
    const value = localToday()
    setToday(value)
  }, [])

  const refreshComposerContext = React.useCallback(async (
    selectedDate: string,
    selectedClientId: string,
    showError = true
  ) => {
    const requestId = composerRequestRef.current + 1
    composerRequestRef.current = requestId
    setComposerContextLoading(true)
    const result = await getLmsWorkComposerContext({
      selectedDate,
      lmsAllocationId: selectedClientId || null,
    })
    if (requestId !== composerRequestRef.current) return
    setComposerContextLoading(false)
    if (!result.success) {
      if (showError) toast.error(result.error)
      return
    }
    setComposerContext(result.context)
  }, [])

  React.useEffect(() => {
    const weekStart = getLmsWorkWeekDates(workDate)[0]
    if (
      composerContext.weekStart === weekStart
      && composerContext.lmsAllocationId === (lmsAllocationId || null)
    ) return
    void refreshComposerContext(workDate, lmsAllocationId)
  }, [composerContext.lmsAllocationId, composerContext.weekStart, lmsAllocationId, refreshComposerContext, workDate])

  React.useEffect(() => {
    setPeriod(activePeriod)
    setCustomFrom(data.from || "")
    setCustomTo(data.to || "")
  }, [activePeriod, data.from, data.to])

  React.useEffect(() => {
    setClientOptions(data.clients)
  }, [data.clients])

  React.useEffect(() => {
    const visibleIds = new Set(data.entries.map((entry) => entry.id))
    setSelectedEntryIds((current) => {
      const next = current.filter((id) => visibleIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [data.entries])

  function navigateToRange(nextPeriod: string, from: string | null, to: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    next.set("period", nextPeriod)
    if (from) next.set("from", from)
    else next.delete("from")
    if (to) next.set("to", to)
    else next.delete("to")
    next.delete("date")
    next.delete("page")
    router.replace(`${pathname}?${next.toString()}`)
  }

  function selectPeriod(value: string) {
    setPeriod(value)
    if (value === CUSTOM_PERIOD) {
      setCustomFrom(data.from || "")
      setCustomTo(data.to || "")
      window.requestAnimationFrame(() => setCustomRangeOpen(true))
      return
    }
    setCustomRangeOpen(false)
    const preset = resolveLmsDatePreset(value)
    navigateToRange(value, preset.from, preset.to)
  }

  function cancelCustomRange() {
    setCustomRangeOpen(false)
    setPeriod(activePeriod)
    setCustomFrom(data.from || "")
    setCustomTo(data.to || "")
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return
    setCustomRangeOpen(false)
    navigateToRange(CUSTOM_PERIOD, customFrom, customTo)
  }

  function updateListFilter(name: "date" | "client" | "task" | "exportStatus" | "pageSize", value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete("page")
    router.replace(`${pathname}?${next.toString()}`)
  }

  function selectDuration(value: string) {
    setDurationSelection(value)
    setCustomMinutesTouched(false)
    if (value === CUSTOM_DURATION_VALUE) {
      window.requestAnimationFrame(() => customMinutesRef.current?.focus())
    }
  }

  function selectWorkDate(value: string) {
    if (!isSelectableWorkDate(value)) return
    setWorkDate(value)
    const nextWeekStart = getLmsWorkWeekDates(value)[0]
    setComposerContext((current) => current.weekStart === nextWeekStart
      ? { ...current, selectedDate: value }
      : current)
  }

  function selectTask(value: string) {
    setTaskTypeId(value)
    const task = activeTasks.find((option) => option.id === value)
    const selection = getLmsWorkDefaultDurationSelection(task?.defaultDurationMinutes)
    setDurationSelection(selection.durationSelection)
    setCustomMinutes(selection.customMinutes)
    setCustomMinutesTouched(false)
  }

  function toggleEntrySelection(id: string, checked: boolean) {
    setSelectedEntryIds((current) => checked
      ? current.includes(id) ? current : [...current, id]
      : current.filter((entryId) => entryId !== id))
  }

  function toggleVisibleEntries(checked: boolean) {
    setSelectedEntryIds(checked ? data.entries.map((entry) => entry.id) : [])
  }

  function openAddClient(name = "") {
    setAddClientInitialName(name)
    setAddClientOpen(true)
  }

  async function submitWorkEntry() {
    const entry: LmsWorkEntryInput = {
      workDate: effectiveWorkDate,
      lmsAllocationId,
      taskTypeId,
      durationMinutes: durationMinutes ?? 0,
    }
    if (!composerCanSubmit || !entry.workDate || durationMinutes === null) {
      setFormAttempted(true)
      if (customDurationEnabled) setCustomMinutesTouched(true)
      return
    }

    setSaving(true)
    const result = await createLmsWorkEntry(entry)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success("Work recorded")
    setComposerContext((current) => {
      if (!current.days.some((day) => day.date === entry.workDate)) return current
      return {
        ...current,
        days: current.days.map((day) => day.date === entry.workDate
          ? { ...day, totalMinutes: day.totalMinutes + entry.durationMinutes }
          : day),
      }
    })
    setTaskTypeId("")
    setDurationSelection("")
    setCustomMinutes("")
    setCustomMinutesTouched(false)
    setFormAttempted(false)
    void refreshComposerContext(entry.workDate, entry.lmsAllocationId, false)
    router.refresh()
    window.requestAnimationFrame(() => taskTriggerRef.current?.focus())
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    await submitWorkEntry()
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      if (!saving) void submitWorkEntry()
    }
  }

  async function handleDelete(entry: LmsWorkEntryRow) {
    if (!window.confirm(`Delete ${entry.taskName} for ${entry.clientDomain}?`)) return
    setDeletingId(entry.id)
    const result = await deleteLmsWorkEntry(entry.id)
    setDeletingId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success("Work entry deleted")
    router.refresh()
  }

  async function handleExport() {
    setExporting(true)
    try {
      const query = new URLSearchParams()
      if (data.from) query.set("from", data.from)
      if (data.to) query.set("to", data.to)
      if (data.workDate) query.set("date", data.workDate)
      if (data.clientId) query.set("client", data.clientId)
      if (data.taskId) query.set("task", data.taskId)
      query.set("exportStatus", data.exportStatus)
      if (exportAll) query.set("includeExported", "true")
      const response = await fetch(`/api/lms-work-entries/export?${query.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Export failed")
      }
      const expectedExportCount = exportAll ? exportAllEntryCount : data.unexportedEntries
      const exportedCount = await downloadExportResponse(response, expectedExportCount)
      toast.success(`${exportedCount} ${exportedCount === 1 ? "entry" : "entries"} exported and marked`)
      setExportAll(false)
      setSelectedEntryIds([])
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  async function handleExportSelected() {
    if (selectedEntryIds.length === 0) return
    setExportingSelected(true)
    try {
      const response = await fetch("/api/lms-work-entries/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedEntryIds }),
        cache: "no-store",
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Selected export failed")
      }
      const exportedCount = await downloadExportResponse(response, selectedEntryIds.length)
      toast.success(`${exportedCount} selected ${exportedCount === 1 ? "entry" : "entries"} exported and marked`)
      setSelectedEntryIds([])
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Selected export failed")
    } finally {
      setExportingSelected(false)
    }
  }

  function buildPageHref(page: number) {
    const next = new URLSearchParams(searchParams.toString())
    next.set("page", String(page))
    return `${pathname}?${next.toString()}`
  }

  return (
    <div className="space-y-6 pb-8">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5 text-[var(--brand-primary)]" />Record work</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form
            onSubmit={handleCreate}
            onKeyDown={handleComposerKeyDown}
            className="grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,29fr)_minmax(360px,21fr)]"
          >
            <div className="xl:col-span-2">
              <WorkWeekNavigator
                selectedDate={workDate}
                today={today}
                context={composerContext}
                loading={composerContextLoading}
                onSelectDate={selectWorkDate}
              />
            </div>

            <div className="grid content-start gap-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-[var(--brand-primary)]" />Client</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs font-semibold text-[var(--brand-primary)]"
                    onClick={() => openAddClient()}
                  >
                    <UserPlus className="h-4 w-4" />
                    Add client
                  </Button>
                </div>
                <ClientCombobox
                  clients={clientOptions}
                  value={lmsAllocationId}
                  onValueChange={setLmsAllocationId}
                  onCreateRequest={openAddClient}
                  large
                />
                <FrequentWorkOptions
                  ariaLabel="Frequently used clients"
                  options={frequentClientOptions.map((client) => ({ id: client.id, label: client.client }))}
                  value={lmsAllocationId}
                  onValueChange={setLmsAllocationId}
                />
                {formAttempted && !hasSelectedClient ? (
                  <p className="text-xs font-medium text-red-600">Select a client.</p>
                ) : null}
              </div>
              <div className="space-y-2.5">
                <Label className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-[var(--brand-primary)]" />Task</Label>
                <TaskCombobox
                  tasks={data.tasks}
                  value={taskTypeId}
                  onValueChange={selectTask}
                  triggerRef={taskTriggerRef}
                  large
                />
                <FrequentWorkOptions
                  ariaLabel="Frequently used tasks"
                  options={composerContext.frequentTasks.map((task) => ({ id: task.id, label: task.name }))}
                  value={taskTypeId}
                  onValueChange={selectTask}
                  twoRows
                />
                {formAttempted && !hasSelectedTask ? (
                  <p className="text-xs font-medium text-red-600">Select a task.</p>
                ) : null}
              </div>
            </div>

            <div className="flex h-full flex-col gap-4 border-t border-[var(--line-subtle)] pt-4 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
              <div className="space-y-2.5">
                <Label className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-[var(--brand-primary)]" />Minutes</Label>
                <div
                  role="group"
                  aria-label="Minutes"
                  aria-describedby={(customMinutesTouched || formAttempted) && durationMinutes === null
                    ? "duration-selection-error"
                    : undefined}
                  className="grid grid-cols-3 gap-2"
                >
                  {LMS_WORK_DURATION_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={durationMinutes === preset ? "default" : "outline"}
                      aria-pressed={durationMinutes === preset}
                      onClick={() => selectDuration(String(preset))}
                      title={`${preset} minutes`}
                      className="h-9 rounded-lg px-2 text-xs font-semibold sm:text-sm"
                    >
                      {preset} min
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={customDurationEnabled ? "default" : "outline"}
                    aria-pressed={customDurationEnabled}
                    onClick={() => selectDuration(CUSTOM_DURATION_VALUE)}
                    className="h-9 rounded-lg px-2 text-xs font-semibold sm:text-sm"
                  >
                    Custom
                  </Button>
                </div>
                {customDurationEnabled ? (
                  <div className="relative">
                    <Input
                      ref={customMinutesRef}
                      aria-label="Custom minutes"
                      aria-invalid={(customMinutesTouched || formAttempted) && customDurationInvalid}
                      aria-describedby={(customMinutesTouched || formAttempted) && customDurationInvalid
                        ? "duration-selection-error"
                        : undefined}
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      inputMode="numeric"
                      value={customMinutes}
                      onChange={(event) => setCustomMinutes(event.target.value)}
                      onBlur={() => setCustomMinutesTouched(true)}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return
                        event.preventDefault()
                        setDurationSelection("")
                        setCustomMinutes("")
                        setCustomMinutesTouched(false)
                      }}
                      placeholder="Enter minutes"
                      className="h-10! pr-11 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Clock3 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                ) : null}
                {(customMinutesTouched || formAttempted) && durationMinutes === null ? (
                  <p id="duration-selection-error" className="text-xs font-medium text-red-600">
                    {customDurationInvalid ? "Enter 1–1440 whole minutes." : "Select a duration."}
                  </p>
                ) : null}
              </div>

              <div className="flex items-end justify-between gap-4 border-t border-[var(--line-subtle)] pt-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-wide text-[var(--text-primary)]">
                    {formatSelectedWorkDate(workDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]" aria-live="polite">
                    Already logged: <span className="font-semibold text-[var(--text-secondary)]">{formatCompactLmsWorkDuration(selectedDayTotal)}</span>
                  </p>
                </div>
                {composerContextLoading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" aria-label="Updating work totals" /> : null}
              </div>

              <Button
                type="submit"
                className="mt-auto h-11! w-full rounded-xl text-sm font-semibold"
                disabled={saving || !composerCanSubmit}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                {saving
                  ? "Saving…"
                  : durationMinutes === null
                    ? `Save · ${formatSaveWorkDate(workDate)}`
                    : `Save ${durationMinutes} min · ${formatSaveWorkDate(workDate)}`}
              </Button>
            </div>
          </form>
          {activeTasks.length === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No active work tasks are configured.{" "}
              <Link href="/lms-analysis/data#task-catalog" className="font-semibold underline underline-offset-2">
                Configure tasks in Settings
              </Link>
              .
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
            <CardTitle className="flex h-9 shrink-0 items-center gap-2 text-lg xl:mr-auto"><FileSpreadsheet className="h-5 w-5 text-[var(--brand-primary)]" />Work entries</CardTitle>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
              <Select value={period} onValueChange={selectPeriod}>
                <SelectTrigger
                  className="w-full sm:w-[360px]"
                  aria-label={`Date range: ${periodDisplayLabel}`}
                  title={periodDisplayLabel}
                >
                  <SelectValue>{periodDisplayLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}
                  <SelectItem value={CUSTOM_PERIOD}>Custom</SelectItem>
                </SelectContent>
              </Select>
              {period === CUSTOM_PERIOD ? (
                <WorkEntryCustomRangePicker
                  open={customRangeOpen}
                  onOpenChange={(nextOpen) => {
                    if (nextOpen) setCustomRangeOpen(true)
                    else cancelCustomRange()
                  }}
                  from={customFrom}
                  to={customTo}
                  onRangeChange={(from, to) => {
                    setCustomFrom(from)
                    setCustomTo(to)
                  }}
                  onApply={applyCustomRange}
                  onCancel={cancelCustomRange}
                />
              ) : null}
            </div>
            <div className="flex h-9 shrink-0 items-center gap-2 px-1">
              <Checkbox
                id="export-all-entries"
                checked={exportAll}
                onCheckedChange={(checked) => setExportAll(checked === true)}
                disabled={exportBusy || exportAllEntryCount === 0}
              />
              <Label
                htmlFor="export-all-entries"
                className="cursor-pointer whitespace-nowrap text-xs font-medium"
                title="Include entries that were already exported"
              >
                Export all
              </Label>
            </div>
            <Button
              className="shrink-0 border-transparent bg-[var(--action-strong)] text-[var(--action-strong-foreground)] hover:bg-[color:color-mix(in_srgb,var(--action-strong)_88%,var(--text-secondary))]"
              type="button"
              onClick={handleExport}
              disabled={exportBusy || (exportAll ? exportAllEntryCount === 0 : data.unexportedEntries === 0)}
            >
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exportAll
                ? `Export all ${exportAllEntryCount}`
                : data.unexportedEntries > 0
                  ? `Export ${data.unexportedEntries} new`
                  : "All exported"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 md:hidden">
            <WorkEntryFilterCombobox
              ariaLabel="Filter work entries by date"
              allLabel="All dates"
              searchPlaceholder="Search dates..."
              emptyLabel="No matching date in these results."
              unavailableLabel="Unavailable date"
              options={data.dateFilterOptions.map((date) => ({ id: date, label: formatEntryDate(date) }))}
              value={data.workDate || ""}
              selectedValueLabel={data.workDate ? formatEntryDate(data.workDate) : undefined}
              onValueChange={(value) => updateListFilter("date", value)}
              fullWidth
            />
            <WorkEntryFilterCombobox
              ariaLabel="Filter work entries by client"
              allLabel="All clients"
              searchPlaceholder="Search clients..."
              emptyLabel="No matching client in these results."
              unavailableLabel="Unavailable client"
              options={data.clientFilterOptions}
              value={data.clientId || ""}
              selectedValueLabel={clientOptions.find((client) => client.id === data.clientId)?.client}
              onValueChange={(value) => updateListFilter("client", value)}
              fullWidth
            />
            <WorkEntryFilterCombobox
              ariaLabel="Filter work entries by task"
              allLabel="All tasks"
              searchPlaceholder="Search tasks..."
              emptyLabel="No matching task in these results."
              unavailableLabel="Unavailable task"
              options={data.taskFilterOptions}
              value={data.taskId || ""}
              selectedValueLabel={data.tasks.find((task) => task.id === data.taskId)?.name}
              onValueChange={(value) => updateListFilter("task", value)}
              fullWidth
            />
            <WorkEntryFilterCombobox
              ariaLabel="Filter work entries by CRM export status"
              allLabel="All export statuses"
              allValue="all"
              searchPlaceholder="Search export status..."
              emptyLabel="No export status found."
              unavailableLabel="Unavailable export status"
              options={EXPORT_STATUS_FILTER_OPTIONS}
              value={data.exportStatus}
              onValueChange={(value) => updateListFilter("exportStatus", value)}
              fullWidth
            />
          </div>
          {data.entries.length > 0 ? (
            <div className="flex items-center gap-2 md:hidden">
              <Checkbox
                id="select-visible-work-entries-mobile"
                checked={allVisibleEntriesSelected ? true : someVisibleEntriesSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => toggleVisibleEntries(checked === true)}
                disabled={exportBusy}
              />
              <Label htmlFor="select-visible-work-entries-mobile" className="cursor-pointer text-xs font-medium text-[var(--text-secondary)]">
                Select all {data.entries.length} visible rows
              </Label>
            </div>
          ) : null}
          {selectedEntryIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[color:color-mix(in_srgb,var(--brand-cyan)_35%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_7%,var(--bg-surface))] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {selectedEntryIds.length} {selectedEntryIds.length === 1 ? "row" : "rows"} selected
              </span>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEntryIds([])} disabled={exportBusy}>
                  Clear
                </Button>
                <Button type="button" size="sm" onClick={handleExportSelected} disabled={exportBusy} className="bg-[var(--action-strong)] text-[var(--action-strong-foreground)] hover:bg-[color:color-mix(in_srgb,var(--action-strong)_88%,var(--text-secondary))]">
                  {exportingSelected ? <Loader2 className="animate-spin" /> : <Download />}
                  Export selected
                </Button>
              </div>
            </div>
          ) : null}
          <div className="hidden overflow-hidden rounded-2xl border border-[var(--line-subtle)] md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleEntriesSelected ? true : someVisibleEntriesSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleVisibleEntries(checked === true)}
                      disabled={exportBusy || data.entries.length === 0}
                      aria-label={`Select all ${data.entries.length} visible work entries`}
                    />
                  </TableHead>
                  <TableHead>
                    <WorkEntryFilterCombobox
                      ariaLabel="Filter work entries by date"
                      allLabel="All dates"
                      searchPlaceholder="Search dates..."
                      emptyLabel="No matching date in these results."
                      unavailableLabel="Unavailable date"
                      options={data.dateFilterOptions.map((date) => ({ id: date, label: formatEntryDate(date) }))}
                      value={data.workDate || ""}
                      selectedValueLabel={data.workDate ? formatEntryDate(data.workDate) : undefined}
                      onValueChange={(value) => updateListFilter("date", value)}
                      triggerLabel="Date"
                    />
                  </TableHead>
                  <TableHead>
                    <WorkEntryFilterCombobox
                      ariaLabel="Filter work entries by client"
                      allLabel="All clients"
                      searchPlaceholder="Search clients..."
                      emptyLabel="No matching client in these results."
                      unavailableLabel="Unavailable client"
                      options={data.clientFilterOptions}
                      value={data.clientId || ""}
                      selectedValueLabel={clientOptions.find((client) => client.id === data.clientId)?.client}
                      onValueChange={(value) => updateListFilter("client", value)}
                      triggerLabel="Client"
                    />
                  </TableHead>
                  <TableHead>
                    <WorkEntryFilterCombobox
                      ariaLabel="Filter work entries by task"
                      allLabel="All tasks"
                      searchPlaceholder="Search tasks..."
                      emptyLabel="No matching task in these results."
                      unavailableLabel="Unavailable task"
                      options={data.taskFilterOptions}
                      value={data.taskId || ""}
                      selectedValueLabel={data.tasks.find((task) => task.id === data.taskId)?.name}
                      onValueChange={(value) => updateListFilter("task", value)}
                      triggerLabel="Task"
                    />
                  </TableHead>
                  <TableHead className="text-right">Minutes</TableHead>
                  <TableHead>
                    <WorkEntryFilterCombobox
                      ariaLabel="Filter work entries by CRM export status"
                      allLabel="All export statuses"
                      allValue="all"
                      searchPlaceholder="Search export status..."
                      emptyLabel="No export status found."
                      unavailableLabel="Unavailable export status"
                      options={EXPORT_STATUS_FILTER_OPTIONS}
                      value={data.exportStatus}
                      onValueChange={(value) => updateListFilter("exportStatus", value)}
                      triggerLabel="CRM export"
                    />
                  </TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={cn(selectedEntryIdSet.has(entry.id) && "bg-[color:color-mix(in_srgb,var(--brand-cyan)_6%,transparent)]")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedEntryIdSet.has(entry.id)}
                        onCheckedChange={(checked) => toggleEntrySelection(entry.id, checked === true)}
                        disabled={exportBusy}
                        aria-label={`Select ${entry.taskName} for ${entry.clientDomain}`}
                      />
                    </TableCell>
                    <TableCell>{formatEntryDate(entry.workDate)}</TableCell>
                    <TableCell className="font-medium">{entry.clientDomain}</TableCell>
                    <TableCell>{entry.taskName}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{entry.durationMinutes}</TableCell>
                    <TableCell><ExportStatusBadge exportedAt={entry.exportedAt} /></TableCell>
                    <TableCell><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingEntry(entry)} aria-label={`Edit ${entry.taskName}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(entry)} disabled={deletingId === entry.id} aria-label={`Delete ${entry.taskName}`} className="text-red-600">{deletingId === entry.id ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button></div></TableCell>
                  </TableRow>
                ))}
                {data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <p className="font-semibold text-[var(--text-primary)]">No work entries match these filters</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Change the date, client, task, export status, or range.</p>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {data.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-4 py-12 text-center md:hidden">
              <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
              <p className="font-semibold text-[var(--text-primary)]">No work entries match these filters</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Change the date, client, task, export status, or range.</p>
            </div>
          ) : (
            <div className="space-y-3 md:hidden">
              {data.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-4",
                    selectedEntryIdSet.has(entry.id) && "border-[color:color-mix(in_srgb,var(--brand-cyan)_40%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-cyan)_6%,var(--bg-surface-soft))]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={selectedEntryIdSet.has(entry.id)}
                      onCheckedChange={(checked) => toggleEntrySelection(entry.id, checked === true)}
                      disabled={exportBusy}
                      aria-label={`Select ${entry.taskName} for ${entry.clientDomain}`}
                    />
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-semibold text-[var(--text-primary)]">{entry.taskName}</p><p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{entry.clientDomain}</p></div>
                      <Badge variant="secondary">{formatMinutes(entry.durationMinutes)}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="space-y-2">
                      <span className="block text-xs text-[var(--text-muted)]">{formatEntryDate(entry.workDate)}</span>
                      <ExportStatusBadge exportedAt={entry.exportedAt} />
                    </div>
                    <div className="flex gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingEntry(entry)} aria-label={`Edit ${entry.taskName}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(entry)} disabled={deletingId === entry.id} aria-label={`Delete ${entry.taskName}`} className="text-red-600">{deletingId === entry.id ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.totalEntries > 0 ? (
            <div className="flex flex-col gap-3 border-t border-[var(--line-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                <span>Showing {firstVisibleEntry}–{lastVisibleEntry} of {data.totalEntries}</span>
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap text-xs" htmlFor="work-entry-page-size">Rows per page</Label>
                  <Select
                    value={String(data.pageSize)}
                    onValueChange={(value) => updateListFilter("pageSize", value)}
                  >
                    <SelectTrigger id="work-entry-page-size" className="h-8! w-20" aria-label="Rows per page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {LMS_WORK_LOG_PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span>Page {data.page} of {data.totalPages}</span>
              </div>
              <div className="flex gap-2 sm:justify-end">
                {data.page > 1 ? (
                  <Button asChild variant="outline" size="sm"><Link href={buildPageHref(data.page - 1)}><ChevronLeft /> Previous</Link></Button>
                ) : (
                  <Button variant="outline" size="sm" disabled><ChevronLeft /> Previous</Button>
                )}
                {data.page < data.totalPages ? (
                  <Button asChild variant="outline" size="sm"><Link href={buildPageHref(data.page + 1)}>Next <ChevronRight /></Link></Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>Next <ChevronRight /></Button>
                )}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 border-t border-[var(--line-subtle)] pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-3 py-2.5">
              <ListChecks className="h-5 w-5 text-[var(--brand-primary)]" />
              <div><p className="text-xs text-[var(--text-muted)]">Tasks logged</p><p className="font-semibold text-[var(--text-primary)]">{data.totalEntries}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-3 py-2.5">
              <CalendarCheck2 className="h-5 w-5 text-[var(--brand-primary)]" />
              <div><p className="text-xs text-[var(--text-muted)]">Days logged</p><p className="font-semibold text-[var(--text-primary)]">{data.workedDays}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-3 py-2.5">
              <Clock3 className="h-5 w-5 text-[var(--brand-primary)]" />
              <div><p className="text-xs text-[var(--text-muted)]">Total time</p><p className="font-semibold text-[var(--text-primary)]">{formatMinutes(data.totalMinutes)}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-3 py-2.5">
              <CalendarDays className="h-5 w-5 text-[var(--brand-primary)]" />
              <div><p className="text-xs text-[var(--text-muted)]">Capacity</p><p className="font-semibold text-[var(--text-primary)]">{workCapacity ? `${workCapacity.hours}h · ${workUtilizationPercent}%` : "Choose a date range"}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-3 py-2.5">
              <FileSpreadsheet className="h-5 w-5 text-[var(--brand-primary)]" />
              <div><p className="text-xs text-[var(--text-muted)]">Pending export</p><p className="font-semibold text-[var(--text-primary)]">{data.unexportedEntries}</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditEntryDialog entry={editingEntry} clients={clientOptions} tasks={data.tasks} onClose={() => setEditingEntry(null)} />
      <AddClientDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        initialName={addClientInitialName}
        onCreated={(client) => {
          setClientOptions((current) => {
            const withoutClient = current.filter((option) => option.id !== client.id)
            return [...withoutClient, client].sort((a, b) => a.client.localeCompare(b.client, "ro"))
          })
          setLmsAllocationId(client.id)
          router.refresh()
        }}
      />
    </div>
  )
}
