"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, parseISO } from "date-fns"
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import {
  createLmsWorkEntry,
  deleteLmsWorkEntry,
  updateLmsWorkEntry,
} from "@/lib/actions/lms-work-entries"
import { getLmsDatePresets, resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import { matchesLmsClientSearch } from "@/lib/lms-work-entries/client-search"
import { formatLmsWorkDateLabel, getLmsWorkCapacity } from "@/lib/lms-work-entries/date"
import {
  DEFAULT_LMS_WORK_DURATION_MINUTES,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
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

function ClientCombobox({
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
  const selectedClient = clients.find((client) => client.id === value)
  const [search, setSearch] = React.useState(selectedClient?.client ?? "")
  const [activeClientId, setActiveClientId] = React.useState<string | null>(null)
  const listboxId = React.useId()
  const skipClearedSelectionSync = React.useRef(false)
  const previousSelection = React.useRef({ value, label: selectedClient?.client ?? "" })
  const filteredClients = React.useMemo(
    () => clients.filter((client) => matchesLmsClientSearch(client.client, search)),
    [clients, search]
  )

  React.useEffect(() => {
    const label = selectedClient?.client ?? ""
    if (previousSelection.current.value === value && previousSelection.current.label === label) return
    previousSelection.current = { value, label }

    if (!value && skipClearedSelectionSync.current) {
      skipClearedSelectionSync.current = false
      return
    }
    skipClearedSelectionSync.current = false
    setSearch(label)
  }, [selectedClient?.client, value])

  React.useEffect(() => {
    if (!open) return
    setActiveClientId((current) => (
      current && filteredClients.some((client) => client.id === current)
        ? current
        : filteredClients[0]?.id ?? null
    ))
  }, [filteredClients, open])

  React.useEffect(() => {
    if (!open || !activeClientId) return
    document.getElementById(`${listboxId}-${activeClientId}`)?.scrollIntoView({ block: "nearest" })
  }, [activeClientId, listboxId, open])

  function selectClient(client: LmsWorkClientOption) {
    setSearch(client.client)
    setActiveClientId(client.id)
    skipClearedSelectionSync.current = false
    onValueChange(client.id)
    setOpen(false)
  }

  function closeClientSearch() {
    setOpen(false)
    setActiveClientId(null)
    setSearch(selectedClient?.client ?? "")
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      closeClientSearch()
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) setOpen(true)
      if (filteredClients.length === 0) return
      const currentIndex = filteredClients.findIndex((client) => client.id === activeClientId)
      const offset = event.key === "ArrowDown" ? 1 : -1
      const nextIndex = currentIndex < 0
        ? (offset === 1 ? 0 : filteredClients.length - 1)
        : (currentIndex + offset + filteredClients.length) % filteredClients.length
      setActiveClientId(filteredClients[nextIndex].id)
      return
    }
    if (event.key === "Enter" && open && activeClientId) {
      const activeClient = filteredClients.find((client) => client.id === activeClientId)
      if (activeClient) {
        event.preventDefault()
        selectClient(activeClient)
      }
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true)
        else closeClientSearch()
      }}
    >
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeClientId ? `${listboxId}-${activeClientId}` : undefined}
            aria-label="Select LMS client"
            autoComplete="off"
            value={search}
            placeholder={clients.length ? "Search LMS clients" : "No LMS clients imported"}
            onFocus={(event) => {
              setOpen(true)
              if (selectedClient) event.currentTarget.select()
            }}
            onChange={(event) => {
              const nextSearch = event.target.value
              setSearch(nextSearch)
              setOpen(true)
              if (value) {
                skipClearedSelectionSync.current = true
                onValueChange("")
              }
            }}
            onKeyDown={handleSearchKeyDown}
            className={cn(
              "w-full pr-10 font-normal",
              large && "h-12! rounded-xl px-4 text-sm"
            )}
            disabled={disabled || clients.length === 0}
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[min(92vw,560px)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label="LMS clients"
          className="max-h-[320px] overflow-y-auto p-1"
        >
          {filteredClients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No LMS client found.</p>
          ) : filteredClients.map((client) => (
            <button
              key={client.id}
              id={`${listboxId}-${client.id}`}
              type="button"
              role="option"
              aria-selected={value === client.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveClientId(client.id)}
              onClick={() => selectClient(client)}
              className={cn(
                "flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-left text-sm outline-none",
                activeClientId === client.id && "bg-accent text-accent-foreground"
              )}
            >
              <Check className={cn("mr-2 h-4 w-4 shrink-0", value === client.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{client.client}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TaskCombobox({
  tasks,
  value,
  onValueChange,
  disabled,
}: {
  tasks: LmsWorkTaskOption[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const options = React.useMemo(() => tasks.filter((task) => task.isActive), [tasks])
  const selectedTask = options.find((task) => task.id === value)
  const [search, setSearch] = React.useState(selectedTask?.name ?? "")
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)
  const listboxId = React.useId()
  const skipClearedSelectionSync = React.useRef(false)
  const previousSelection = React.useRef({ value, label: selectedTask?.name ?? "" })
  const filteredTasks = React.useMemo(
    () => options.filter((task) => matchesLmsClientSearch(task.name, search)),
    [options, search]
  )

  React.useEffect(() => {
    const label = selectedTask?.name ?? ""
    if (previousSelection.current.value === value && previousSelection.current.label === label) return
    previousSelection.current = { value, label }

    if (!value && skipClearedSelectionSync.current) {
      skipClearedSelectionSync.current = false
      return
    }
    skipClearedSelectionSync.current = false
    setSearch(label)
  }, [selectedTask?.name, value])

  React.useEffect(() => {
    if (!open) return
    setActiveTaskId((current) => (
      current && filteredTasks.some((task) => task.id === current)
        ? current
        : filteredTasks[0]?.id ?? null
    ))
  }, [filteredTasks, open])

  React.useEffect(() => {
    if (!open || !activeTaskId) return
    document.getElementById(`${listboxId}-${activeTaskId}`)?.scrollIntoView({ block: "nearest" })
  }, [activeTaskId, listboxId, open])

  function selectTask(task: LmsWorkTaskOption) {
    setSearch(task.name)
    setActiveTaskId(task.id)
    skipClearedSelectionSync.current = false
    onValueChange(task.id)
    setOpen(false)
  }

  function closeTaskSearch() {
    setOpen(false)
    setActiveTaskId(null)
    setSearch(selectedTask?.name ?? "")
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      closeTaskSearch()
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) setOpen(true)
      if (filteredTasks.length === 0) return
      const currentIndex = filteredTasks.findIndex((task) => task.id === activeTaskId)
      const offset = event.key === "ArrowDown" ? 1 : -1
      const nextIndex = currentIndex < 0
        ? (offset === 1 ? 0 : filteredTasks.length - 1)
        : (currentIndex + offset + filteredTasks.length) % filteredTasks.length
      setActiveTaskId(filteredTasks[nextIndex].id)
      return
    }
    if (event.key === "Enter" && open && activeTaskId) {
      const activeTask = filteredTasks.find((task) => task.id === activeTaskId)
      if (activeTask) {
        event.preventDefault()
        selectTask(activeTask)
      }
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true)
        else closeTaskSearch()
      }}
    >
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeTaskId ? `${listboxId}-${activeTaskId}` : undefined}
            aria-label="Select predefined task"
            autoComplete="off"
            value={search}
            placeholder={options.length ? "Search predefined tasks" : "Add a task first"}
            onFocus={(event) => {
              setOpen(true)
              if (selectedTask) event.currentTarget.select()
            }}
            onChange={(event) => {
              const nextSearch = event.target.value
              setSearch(nextSearch)
              setOpen(true)
              if (value) {
                skipClearedSelectionSync.current = true
                onValueChange("")
              }
            }}
            onKeyDown={handleSearchKeyDown}
            className="h-12! w-full rounded-xl px-4 pr-10 text-sm font-normal"
            disabled={disabled || options.length === 0}
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[min(92vw,560px)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div
          id={listboxId}
          role="listbox"
          aria-label="Predefined tasks"
          className="max-h-[280px] overflow-y-auto p-1"
        >
          {filteredTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No work-entry task found.</p>
          ) : filteredTasks.map((task) => (
            <button
              key={task.id}
              id={`${listboxId}-${task.id}`}
              type="button"
              role="option"
              aria-selected={value === task.id}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveTaskId(task.id)}
              onClick={() => selectTask(task)}
              className={cn(
                "flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-left text-sm outline-none",
                activeTaskId === task.id && "bg-accent text-accent-foreground"
              )}
            >
              <Check className={cn("mr-2 h-4 w-4 shrink-0", value === task.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{task.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FrequentWorkOptions({
  ariaLabel,
  options,
  value,
  onValueChange,
}: {
  ariaLabel: string
  options: Array<{ id: string; label: string }>
  value: string
  onValueChange: (value: string) => void
}) {
  if (options.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-[var(--text-muted)]">Frequently used</p>
      <div role="group" aria-label={ariaLabel} className="flex gap-1.5 overflow-x-auto pb-1">
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={value === option.id ? "default" : "outline"}
            aria-pressed={value === option.id}
            title={option.label}
            onClick={() => onValueChange(option.id)}
            className="h-8 min-w-32 max-w-48 flex-1 shrink-0 rounded-lg px-2 text-xs font-semibold"
          >
            <span className="truncate">{option.label}</span>
          </Button>
        ))}
      </div>
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
  const [lmsAllocationId, setLmsAllocationId] = React.useState("")
  const [taskTypeId, setTaskTypeId] = React.useState("")
  const [durationSelection, setDurationSelection] = React.useState(String(DEFAULT_LMS_WORK_DURATION_MINUTES))
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
  const hasSelectedClient = data.clients.some((client) => client.id === lmsAllocationId)
  const hasSelectedTask = activeTasks.some((task) => task.id === taskTypeId)
  const customDurationEnabled = durationSelection === CUSTOM_DURATION_VALUE
  const selectedPresetMinutes = Number(durationSelection)
  const durationMinutes = customDurationEnabled
    ? parseCustomLmsWorkDuration(customMinutes)
    : isLmsWorkDurationPreset(selectedPresetMinutes) ? selectedPresetMinutes : null
  const customDurationInvalid = customDurationEnabled && customMinutes.trim().length > 0 && durationMinutes === null
  const effectiveWorkDate = differentDate ? workDate : today
  const effectiveDateLabel = formatLmsWorkDateLabel(effectiveWorkDate, today)
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

  function selectDurationShortcut(value: number) {
    if (isLmsWorkDurationPreset(value)) {
      setDurationSelection(String(value))
      return
    }
    setDurationSelection(CUSTOM_DURATION_VALUE)
    setCustomMinutes(String(value))
    window.requestAnimationFrame(() => customMinutesRef.current?.focus())
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
    setDurationSelection(String(DEFAULT_LMS_WORK_DURATION_MINUTES))
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
            <div className="space-y-5 xl:col-start-1 xl:row-start-1">
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Client</Label>
                <ClientCombobox clients={data.clients} value={lmsAllocationId} onValueChange={setLmsAllocationId} large />
                <FrequentWorkOptions
                  ariaLabel="Frequently used clients"
                  options={data.frequentClients.map((client) => ({ id: client.id, label: client.client }))}
                  value={lmsAllocationId}
                  onValueChange={setLmsAllocationId}
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold">Task</Label>
                <TaskCombobox tasks={data.tasks} value={taskTypeId} onValueChange={setTaskTypeId} />
                <FrequentWorkOptions
                  ariaLabel="Frequently used tasks"
                  options={data.frequentTasks.map((task) => ({ id: task.id, label: task.name }))}
                  value={taskTypeId}
                  onValueChange={setTaskTypeId}
                />
              </div>
            </div>

            <div className="h-full space-y-4 border-t border-[var(--line-subtle)] pt-5 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold">Date</Label>
                    <p className="mt-1 truncate text-base font-semibold text-[var(--text-primary)]" aria-live="polite">
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
                        if (next) setWorkDate(today)
                      }}
                    />
                    <Label htmlFor="different-work-date" className="cursor-pointer whitespace-nowrap text-xs font-medium text-[var(--text-secondary)]">
                      Other date
                    </Label>
                  </div>
                </div>
                {differentDate ? (
                  <Input
                    aria-label="Work date"
                    className="h-12! w-full"
                    type="date"
                    value={workDate}
                    onChange={(event) => setWorkDate(event.target.value)}
                    required
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="work-duration" className="text-sm font-semibold">Minutes</Label>
                <Select value={durationSelection} onValueChange={selectDuration}>
                  <SelectTrigger id="work-duration" className="h-10! w-full rounded-lg px-3 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {LMS_WORK_DURATION_PRESETS.map((preset) => (
                      <SelectItem key={preset} value={String(preset)}>{preset} min</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_DURATION_VALUE}>Custom</SelectItem>
                  </SelectContent>
                </Select>
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
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[var(--text-muted)]">min</span>
                  </div>
                ) : null}
                {customDurationInvalid ? (
                  <p id="custom-duration-error" className="text-xs font-medium text-red-600">Enter 1–1440 whole minutes.</p>
                ) : null}
                <div className="space-y-1.5 pt-0.5">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Frequently used</p>
                  <div role="group" aria-label="Frequently used durations" className="grid grid-cols-3 gap-1.5">
                    {data.frequentDurations.map((minutes) => (
                      <Button
                        key={minutes}
                        type="button"
                        variant={durationMinutes === minutes ? "default" : "outline"}
                        aria-pressed={durationMinutes === minutes}
                        onClick={() => selectDurationShortcut(minutes)}
                        className="h-8 rounded-lg px-2 text-xs font-semibold"
                      >
                        {minutes} min
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12! w-full rounded-xl text-sm font-semibold xl:col-start-1 xl:row-start-2"
              disabled={
                saving
                || !effectiveWorkDate
                || !hasSelectedClient
                || !hasSelectedTask
                || data.clients.length === 0
                || activeTasks.length === 0
                || durationMinutes === null
              }
            >
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              Save work
            </Button>
          </form>
          {activeTasks.length === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No active work tasks are configured.{" "}
              <Link href="/lms-analysis/data#task-catalog" className="font-semibold underline underline-offset-2">
                Configure tasks in Data
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
              <CardDescription className="mt-2">
                {data.totalEntries} entries · {formatMinutes(data.totalMinutes)} worked
                {workCapacity
                  ? ` · ${workCapacity.hours}h available · ${workUtilizationPercent}%`
                  : " · Available hours require a bounded date range"}
                {` · ${data.unexportedEntries} not exported`}
              </CardDescription>
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
        </CardContent>
      </Card>

      <EditEntryDialog entry={editingEntry} clients={data.clients} tasks={data.tasks} onClose={() => setEditingEntry(null)} />
    </div>
  )
}
