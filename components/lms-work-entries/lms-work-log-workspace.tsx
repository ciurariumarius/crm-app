"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, isWeekend, parseISO } from "date-fns"
import {
  AlertTriangle,
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
  updateLmsWorkEntry,
} from "@/lib/actions/lms-work-entries"
import { getLmsDatePresets, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { matchesLmsClientSearch } from "@/lib/lms-work-entries/client-search"
import { formatLmsWorkDateLabel, getLmsWorkCapacity } from "@/lib/lms-work-entries/date"
import {
  LMS_WORK_DURATION_PRESETS,
  getLmsWorkUtilizationPercent,
  isLmsWorkDurationPreset,
  parseCustomLmsWorkDuration,
} from "@/lib/lms-work-entries/duration-options"
import type {
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

function localToday() {
  return format(new Date(), "yyyy-MM-dd")
}

function formatEntryDate(value: string) {
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, "dd MMM yyyy") : value
}

function isSelectableWorkDate(value: string) {
  if (!value) return false
  const parsed = parseISO(value)
  return isValid(parsed) && !isWeekend(parsed)
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

export function ClientCombobox({
  clients,
  value,
  onValueChange,
  disabled,
  large,
}: {
  clients: LmsWorkClientOption[]
  value: string
  onValueChange: (value: string) => void
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
            large && "h-14 px-4 text-base"
          )}
          disabled={disabled || clients.length === 0}
        >
          <span className={cn("min-w-0 flex-1 truncate", !hasSelection && "text-[var(--text-muted)]")}>
            {selectedClient?.client ?? (clients.length ? "Select LMS client" : "No LMS clients imported")}
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
}: {
  tasks: LmsWorkTaskOption[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  large?: boolean
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
            large ? "h-14 text-base" : "h-12",
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
            <Input id="edit-work-date" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required />
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

function AddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: LmsWorkClientOption) => void
}) {
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

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
            Add a client to LMS Projects and select it immediately for this work entry.
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
}: {
  data: LmsWorkLogPageData
  activePeriod: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [today, setToday] = React.useState("")
  const [differentDate, setDifferentDate] = React.useState(false)
  const [workDate, setWorkDate] = React.useState("")
  const [workDatePickerOpen, setWorkDatePickerOpen] = React.useState(false)
  const [clientOptions, setClientOptions] = React.useState(data.clients)
  const [lmsAllocationId, setLmsAllocationId] = React.useState("")
  const [addClientOpen, setAddClientOpen] = React.useState(false)
  const [taskTypeId, setTaskTypeId] = React.useState("")
  const [durationSelection, setDurationSelection] = React.useState("")
  const [customMinutes, setCustomMinutes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [exportAll, setExportAll] = React.useState(false)
  const [editingEntry, setEditingEntry] = React.useState<LmsWorkEntryRow | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState(activePeriod)
  const [customFrom, setCustomFrom] = React.useState(data.from || "")
  const [customTo, setCustomTo] = React.useState(data.to || "")
  const customMinutesRef = React.useRef<HTMLInputElement | null>(null)
  const presets = React.useMemo(() => getLmsDatePresets(), [])
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
  const customDurationInvalid = customDurationEnabled && customMinutes.trim().length > 0 && durationMinutes === null
  const customWorkDateValid = isSelectableWorkDate(workDate)
  const effectiveWorkDate = differentDate ? (customWorkDateValid ? workDate : "") : today
  const effectiveDateLabel = differentDate && !customWorkDateValid
    ? "Choose a work day"
    : formatLmsWorkDateLabel(effectiveWorkDate, today)
  const selectedWorkDate = customWorkDateValid ? parseISO(workDate) : undefined
  const workCapacity = React.useMemo(() => getLmsWorkCapacity(data.from, data.to), [data.from, data.to])
  const workUtilizationPercent = workCapacity
    ? getLmsWorkUtilizationPercent(data.totalMinutes, workCapacity.hours)
    : null

  React.useEffect(() => {
    const value = localToday()
    setToday(value)
    setWorkDate((current) => current || value)
  }, [])

  React.useEffect(() => {
    setPeriod(activePeriod)
    setCustomFrom(data.from || "")
    setCustomTo(data.to || "")
  }, [activePeriod, data.from, data.to])

  React.useEffect(() => {
    setClientOptions(data.clients)
  }, [data.clients])

  function navigateToRange(nextPeriod: string, from: string | null, to: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    next.set("period", nextPeriod)
    if (from) next.set("from", from)
    else next.delete("from")
    if (to) next.set("to", to)
    else next.delete("to")
    next.delete("page")
    router.replace(`${pathname}?${next.toString()}`)
  }

  function selectPeriod(value: string) {
    setPeriod(value)
    if (value === CUSTOM_PERIOD) return
    const preset = resolveLmsDatePreset(value)
    navigateToRange(value, preset.from, preset.to)
  }

  function selectDuration(value: string) {
    setDurationSelection(value)
    if (value === CUSTOM_DURATION_VALUE) {
      window.requestAnimationFrame(() => customMinutesRef.current?.focus())
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const entry: LmsWorkEntryInput = {
      workDate: effectiveWorkDate,
      lmsAllocationId,
      taskTypeId,
      durationMinutes: durationMinutes ?? 0,
    }
    if (!entry.workDate || !entry.lmsAllocationId || !entry.taskTypeId || durationMinutes === null) {
      toast.error("Complete all fields with valid values")
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
    setLmsAllocationId("")
    setTaskTypeId("")
    setDifferentDate(false)
    setWorkDate(today)
    setDurationSelection("")
    setCustomMinutes("")
    router.refresh()
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
      if (exportAll) query.set("includeExported", "true")
      const response = await fetch(`/api/lms-work-entries/export?${query.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Export failed")
      }
      const expectedExportCount = exportAll ? data.totalEntries : data.unexportedEntries
      const exportedCount = Number(response.headers.get("x-exported-entry-count")) || expectedExportCount
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = href
      anchor.download = getDownloadFilename(response.headers.get("content-disposition"))
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(href)
      toast.success(`${exportedCount} ${exportedCount === 1 ? "entry" : "entries"} exported and marked`)
      setExportAll(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  function buildPageHref(page: number) {
    const next = new URLSearchParams(searchParams.toString())
    next.set("page", String(page))
    return `${pathname}?${next.toString()}`
  }

  return (
    <div className="space-y-6 pb-8">
      <Card className="gap-4 py-6">
        <CardHeader className="px-5 sm:px-7">
          <CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5 text-[var(--brand-primary)]" />Record work</CardTitle>
        </CardHeader>
        <CardContent className="px-5 sm:px-7">
          <form onSubmit={handleCreate} className="grid gap-x-6 gap-y-5 xl:grid-cols-[minmax(0,11fr)_minmax(420px,9fr)]">
            <div className="grid gap-5 xl:col-start-1 xl:row-start-1 xl:h-full xl:grid-rows-2">
              <div className="content-start space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-[var(--brand-primary)]" />Client</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs font-semibold text-[var(--brand-primary)]"
                    onClick={() => setAddClientOpen(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Add client
                  </Button>
                </div>
                <ClientCombobox clients={clientOptions} value={lmsAllocationId} onValueChange={setLmsAllocationId} large />
                <FrequentWorkOptions
                  ariaLabel="Frequently used clients"
                  options={frequentClientOptions.map((client) => ({ id: client.id, label: client.client }))}
                  value={lmsAllocationId}
                  onValueChange={setLmsAllocationId}
                />
              </div>
              <div className="content-start space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4 text-[var(--brand-primary)]" />Task</Label>
                <TaskCombobox tasks={data.tasks} value={taskTypeId} onValueChange={setTaskTypeId} large />
                <FrequentWorkOptions
                  ariaLabel="Frequently used tasks"
                  options={data.frequentTasks.map((task) => ({ id: task.id, label: task.name }))}
                  value={taskTypeId}
                  onValueChange={setTaskTypeId}
                  twoRows
                />
              </div>
            </div>

            <div className="h-full space-y-5 border-t border-[var(--line-subtle)] pt-5 xl:col-start-2 xl:row-start-1 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
              <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Label className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-[var(--brand-primary)]" />Date</Label>
                    <p className="mt-1.5 truncate text-base font-semibold text-[var(--text-primary)]" aria-live="polite">
                      {effectiveDateLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-1">
                    <Checkbox
                      id="different-work-date"
                      checked={differentDate}
                      onCheckedChange={(checked) => {
                        const next = checked === true
                        setDifferentDate(next)
                        if (next) setWorkDate(isSelectableWorkDate(today) ? today : "")
                        else setWorkDatePickerOpen(false)
                      }}
                    />
                    <Label htmlFor="different-work-date" className="cursor-pointer whitespace-nowrap text-xs font-medium text-[var(--text-secondary)]">
                      Other date
                    </Label>
                  </div>
                </div>
                {differentDate ? (
                  <Popover open={workDatePickerOpen} onOpenChange={setWorkDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Work date"
                        aria-expanded={workDatePickerOpen}
                        className="mt-3 h-12 w-full justify-between rounded-xl px-4 text-sm font-medium"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                          <span className="truncate">{workDate ? formatEntryDate(workDate) : "Choose a date"}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-[min(92vw,420px)] overflow-hidden rounded-2xl p-0"
                    >
                      <div className="w-full p-4 [&_[data-slot=calendar]]:![--cell-size:clamp(40px,11vw,48px)] [&_.rdp-month_grid]:!w-full [&_.rdp-weeks]:!w-full">
                        <Calendar
                          mode="single"
                          selected={selectedWorkDate}
                          defaultMonth={selectedWorkDate}
                          disabled={isWeekend}
                          onSelect={(date) => {
                            if (!date || isWeekend(date)) return
                            setWorkDate(format(date, "yyyy-MM-dd"))
                            setWorkDatePickerOpen(false)
                          }}
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
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>

              <div className="space-y-2.5">
                <Label className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-[var(--brand-primary)]" />Minutes</Label>
                <div
                  role="group"
                  aria-label="Minutes"
                  aria-describedby={customDurationInvalid
                    ? "custom-duration-error"
                    : durationMinutes === null ? "duration-selection-warning" : undefined}
                  className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
                >
                  {LMS_WORK_DURATION_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={durationMinutes === preset ? "default" : "outline"}
                      aria-pressed={durationMinutes === preset}
                      onClick={() => selectDuration(String(preset))}
                      title={`${preset} minutes`}
                      className="h-10 gap-1.5 rounded-lg px-2 text-sm font-semibold"
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      {preset}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={customDurationEnabled ? "default" : "outline"}
                    aria-pressed={customDurationEnabled}
                    onClick={() => selectDuration(CUSTOM_DURATION_VALUE)}
                    className="h-10 rounded-lg px-2 text-sm font-semibold"
                  >
                    Custom
                  </Button>
                </div>
                {customDurationEnabled ? (
                  <div className="relative">
                    <Input
                      ref={customMinutesRef}
                      aria-label="Custom minutes"
                      aria-invalid={customDurationInvalid}
                      aria-describedby={customDurationInvalid ? "custom-duration-error" : undefined}
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      inputMode="numeric"
                      value={customMinutes}
                      onChange={(event) => setCustomMinutes(event.target.value)}
                      placeholder="Enter minutes"
                      className="h-10! pr-11 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Clock3 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  </div>
                ) : null}
                {customDurationInvalid ? (
                  <p id="custom-duration-error" className="text-xs font-medium text-red-600">Enter 1–1440 whole minutes.</p>
                ) : null}
                {durationMinutes === null && !customDurationInvalid ? (
                  <p
                    id="duration-selection-warning"
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {customDurationEnabled
                      ? "Enter custom minutes to continue."
                      : "Select the time spent to continue."}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border-t border-[var(--line-subtle)] pt-5 xl:col-span-2 xl:row-start-2">
              <Button
                type="submit"
                className="h-12! w-full rounded-xl text-sm font-semibold"
                disabled={
                  saving
                  || !effectiveWorkDate
                  || !hasSelectedClient
                  || !hasSelectedTask
                  || clientOptions.length === 0
                  || activeTasks.length === 0
                  || durationMinutes === null
                }
              >
                {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                {saving ? "Saving…" : "Save work"}
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><FileSpreadsheet className="h-5 w-5 text-[var(--brand-primary)]" />Work entries</CardTitle>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Date range</Label>
                <Select value={period} onValueChange={selectPeriod}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent align="start">
                    {presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}
                    <SelectItem value={CUSTOM_PERIOD}>Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === CUSTOM_PERIOD ? (
                <>
                  <div className="space-y-1.5"><Label htmlFor="range-from" className="text-xs">From</Label><Input id="range-from" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="range-to" className="text-xs">To</Label><Input id="range-to" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></div>
                  <Button type="button" variant="outline" onClick={() => navigateToRange(CUSTOM_PERIOD, customFrom || null, customTo || null)} disabled={!customFrom && !customTo}>Apply</Button>
                </>
              ) : null}
              <div className="flex h-9 items-center gap-2 px-1">
                <Checkbox
                  id="export-all-entries"
                  checked={exportAll}
                  onCheckedChange={(checked) => setExportAll(checked === true)}
                  disabled={exporting || data.totalEntries === 0}
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
                type="button"
                onClick={handleExport}
                disabled={exporting || (exportAll ? data.totalEntries === 0 : data.unexportedEntries === 0)}
              >
                {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                {exportAll
                  ? `Export all ${data.totalEntries}`
                  : data.unexportedEntries > 0
                    ? `Export ${data.unexportedEntries} new`
                    : "All exported"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line-subtle)] px-4 py-12 text-center">
              <CalendarDays className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
              <p className="font-semibold text-[var(--text-primary)]">No work entries in this range</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Record work above or choose a different date range.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-[var(--line-subtle)] md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="text-right">Minutes</TableHead>
                      <TableHead>CRM export</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatEntryDate(entry.workDate)}</TableCell>
                        <TableCell className="font-medium">{entry.clientDomain}</TableCell>
                        <TableCell>{entry.taskName}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{entry.durationMinutes}</TableCell>
                        <TableCell><ExportStatusBadge exportedAt={entry.exportedAt} /></TableCell>
                        <TableCell><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingEntry(entry)} aria-label={`Edit ${entry.taskName}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(entry)} disabled={deletingId === entry.id} aria-label={`Delete ${entry.taskName}`} className="text-red-600">{deletingId === entry.id ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {data.entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface-soft)] p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[var(--text-primary)]">{entry.taskName}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.clientDomain}</p></div><Badge variant="secondary">{formatMinutes(entry.durationMinutes)}</Badge></div>
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
            </>
          )}

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[var(--line-subtle)] pt-4">
              <p className="text-xs text-[var(--text-muted)]">Page {data.page} of {data.totalPages}</p>
              <div className="flex gap-2">
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
