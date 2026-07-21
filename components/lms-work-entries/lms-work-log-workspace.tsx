"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format, isValid, parseISO } from "date-fns"
import {
  CalendarDays,
  Check,
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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

function getDownloadFilename(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/i)
  return match?.[1] || "TASK_IMPORT.xlsx"
}

function ClientCombobox({
  clients,
  value,
  onValueChange,
  disabled,
}: {
  clients: LmsWorkClientOption[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selectedClient = clients.find((client) => client.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select LMS client"
          className="w-full justify-between overflow-hidden font-normal"
          disabled={disabled || clients.length === 0}
        >
          <span className={cn("truncate", !selectedClient && "text-muted-foreground")}>
            {selectedClient?.client || (clients.length ? "Search LMS clients" : "No LMS clients imported")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[min(92vw,560px)] p-0"
      >
        <Command
          filter={(itemValue, search) => matchesLmsClientSearch(itemValue, search) ? 1 : 0}
        >
          <CommandInput placeholder="Search all LMS clients..." />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No LMS client found.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.client}
                  onSelect={() => {
                    onValueChange(client.id)
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === client.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{client.client}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function TaskSelect({
  tasks,
  value,
  onValueChange,
  currentTaskId,
  disabled,
}: {
  tasks: LmsWorkTaskOption[]
  value: string
  onValueChange: (value: string) => void
  currentTaskId?: string
  disabled?: boolean
}) {
  const options = tasks.filter((task) => task.isActive || task.id === currentTaskId)
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
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
    toast.success("Work entry updated")
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
  const [minutes, setMinutes] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [editingEntry, setEditingEntry] = React.useState<LmsWorkEntryRow | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState(activePeriod)
  const [customFrom, setCustomFrom] = React.useState(data.from || "")
  const [customTo, setCustomTo] = React.useState(data.to || "")
  const presets = React.useMemo(() => getLmsDatePresets(), [])
  const activeTasks = data.tasks.filter((task) => task.isActive)

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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const durationMinutes = Number(minutes)
    const entry: LmsWorkEntryInput = {
      workDate: differentDate ? workDate : today,
      lmsAllocationId,
      taskTypeId,
      durationMinutes,
    }
    if (!entry.workDate || !entry.lmsAllocationId || !entry.taskTypeId || !Number.isInteger(durationMinutes) || durationMinutes < 1) {
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
    setMinutes("")
    setDifferentDate(false)
    setWorkDate(today)
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
      const response = await fetch(`/api/lms-work-entries/export?${query.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Export failed")
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = href
      anchor.download = getDownloadFilename(response.headers.get("content-disposition"))
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(href)
      toast.success("CRM workbook generated")
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
      <Card className="gap-4 py-5">
        <CardHeader className="gap-1 px-5 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg"><Clock3 className="h-5 w-5 text-[var(--brand-primary)]" />Record work</CardTitle>
          <CardDescription>Capture client work quickly. Entries can be exported below in the company CRM format.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 sm:px-6">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.25fr)_120px_150px] lg:items-end">
              <div className="space-y-2">
                <Label>Client</Label>
                <ClientCombobox clients={data.clients} value={lmsAllocationId} onValueChange={setLmsAllocationId} />
              </div>
              <div className="space-y-2">
                <Label>Task</Label>
                <TaskSelect tasks={data.tasks} value={taskTypeId} onValueChange={setTaskTypeId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-minutes">Minutes</Label>
                <div className="relative">
                  <Input
                    id="work-minutes"
                    type="number"
                    min={1}
                    max={1440}
                    step={1}
                    inputMode="numeric"
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    placeholder="45"
                    className="pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    required
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-[var(--text-muted)]">min</span>
                </div>
              </div>
              <Button type="submit" className="h-10 w-full" disabled={saving || !today || data.clients.length === 0 || activeTasks.length === 0}>
                {saving ? <Loader2 className="animate-spin" /> : <Plus />}
                Save entry
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="different-work-date"
                  checked={differentDate}
                  onCheckedChange={(checked) => {
                    const next = checked === true
                    setDifferentDate(next)
                    if (next) setWorkDate(today)
                  }}
                />
                <Label htmlFor="different-work-date" className="cursor-pointer text-xs font-medium text-[var(--text-secondary)]">
                  Select a different date
                </Label>
              </div>
              {differentDate ? (
                <Input aria-label="Work date" className="w-full sm:w-44" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required />
              ) : null}
            </div>
          </form>
          {activeTasks.length === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No active work tasks are configured.{" "}
              <Link href="/lms-analysis/data?section=catalog" className="font-semibold underline underline-offset-2">
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
              <CardDescription className="mt-2">{data.totalEntries} entries · {formatMinutes(data.totalMinutes)} in the selected range</CardDescription>
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
              <Button type="button" onClick={handleExport} disabled={exporting || data.totalEntries === 0}>
                {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                Export XLSX
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
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Task</TableHead><TableHead className="text-right">Minutes</TableHead><TableHead className="w-24 text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatEntryDate(entry.workDate)}</TableCell>
                        <TableCell className="font-medium">{entry.clientDomain}</TableCell>
                        <TableCell>{entry.taskName}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{entry.durationMinutes}</TableCell>
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
                    <div className="mt-4 flex items-center justify-between"><span className="text-xs text-[var(--text-muted)]">{formatEntryDate(entry.workDate)}</span><div className="flex gap-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingEntry(entry)} aria-label={`Edit ${entry.taskName}`}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => handleDelete(entry)} disabled={deletingId === entry.id} aria-label={`Delete ${entry.taskName}`} className="text-red-600">{deletingId === entry.id ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button></div></div>
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
