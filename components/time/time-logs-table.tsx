"use client"

import * as React from "react"
import { format } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowDownUp, Briefcase, CalendarDays, Check, Clock, FileText, Filter, Play, Search, Square, User, X } from "lucide-react"
import { toast } from "sonner"
import { formatProjectName, cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { updateTimeLog } from "@/lib/actions/time"
import { useTimer } from "@/components/providers/timer-provider"
import { TimeLogSheet } from "@/components/time/time-log-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListEmptyState } from "@/components/ui/list-state"

type TimeLogWithDetails = {
    id: string
    description: string | null
    startTime: Date | string
    endTime: Date | string | null
    durationSeconds: number | null
    isPaused: boolean
    source: string
    project: {
        id: string
        name?: string | null
        site: { domainName: string; partner: { id: string; name: string } }
        services: { serviceName: string; isRecurring: boolean }[]
        createdAt: Date | string
    }
    task: { id: string; name: string } | null
}

type TimeLogFilters = {
    projectId: string
    partnerId: string
    taskQ: string
    descriptionQ: string
    source: "all" | "MANUAL" | "TIMER"
    status: "all" | "running" | "completed"
    from: string
    to: string
    minDuration: string
    maxDuration: string
}

type ProjectOption = { id: string; displayName: string }

interface TimeLogsTableProps {
    logs: TimeLogWithDetails[]
    projects: ProjectOption[]
    tasks: Array<{ id: string; name: string; projectId: string }>
    partners: Array<{ id: string; name: string }>
    totalLogs: number
    currentSort: string
    currentOrder: "asc" | "desc"
    filters: TimeLogFilters
}

const GRID = "grid-cols-[142px_150px_minmax(230px,1.4fr)_190px_minmax(220px,1.3fr)_110px_90px_96px_72px]"

export function TimeLogsTable({ logs, projects, tasks, partners, totalLogs, currentSort, currentOrder, filters }: TimeLogsTableProps) {
    const [selectedLog, setSelectedLog] = React.useState<TimeLogWithDetails | null>(null)
    const [stoppingId, setStoppingId] = React.useState<string | null>(null)
    const [taskSearch, setTaskSearch] = React.useState(filters.taskQ)
    const [descriptionSearch, setDescriptionSearch] = React.useState(filters.descriptionQ)
    const debouncedTaskSearch = useDebounce(taskSearch, 300)
    const debouncedDescriptionSearch = useDebounce(descriptionSearch, 300)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { stopTimer, startTimer } = useTimer()

    const updateParams = React.useCallback((updates: Record<string, string | null>, replace = false) => {
        const next = new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (!value || value === "all") next.delete(key)
            else next.set(key, value)
        }
        next.delete("page")
        const href = `/time?${next.toString()}`
        if (replace) router.replace(href, { scroll: false })
        else router.push(href, { scroll: false })
    }, [router, searchParams])

    React.useEffect(() => {
        if (debouncedTaskSearch !== filters.taskQ) updateParams({ taskQ: debouncedTaskSearch || null }, true)
    }, [debouncedTaskSearch, filters.taskQ, updateParams])

    React.useEffect(() => {
        if (debouncedDescriptionSearch !== filters.descriptionQ) updateParams({ descriptionQ: debouncedDescriptionSearch || null }, true)
    }, [debouncedDescriptionSearch, filters.descriptionQ, updateParams])

    React.useEffect(() => setTaskSearch(filters.taskQ), [filters.taskQ])
    React.useEffect(() => setDescriptionSearch(filters.descriptionQ), [filters.descriptionQ])

    const toggleSort = (field: string) => {
        const nextOrder = currentSort === field && currentOrder === "asc" ? "desc" : "asc"
        updateParams({ sort: field === "startTime" ? null : field, order: nextOrder === "desc" ? null : nextOrder })
    }

    const stop = async (event: React.MouseEvent, logId: string) => {
        event.stopPropagation()
        setStoppingId(logId)
        try {
            await stopTimer(logId)
            router.refresh()
        } catch {
            toast.error("Failed to stop timer")
        } finally {
            setStoppingId(null)
        }
    }

    const resume = async (event: React.MouseEvent, log: TimeLogWithDetails) => {
        event.stopPropagation()
        try {
            await startTimer(log.project.id, log.task?.id, log.description || log.task?.name || undefined)
            router.refresh()
        } catch {
            toast.error("Failed to start timer")
        }
    }

    return (
        <div className="relative">
            <div className="overflow-x-auto pb-3 hidescrollbar">
                <div className="flex min-w-[1380px] md:min-w-[960px] xl:min-w-[1240px] flex-col gap-1.5">
                    <div className={cn("grid h-12 items-center gap-x-3 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-4 text-[var(--text-secondary)] shadow-[var(--shadow-apple)]", GRID)}>
                        <Header label={`Started · ${totalLogs}`} field="startTime" currentSort={currentSort} onSort={toggleSort} filterActive={Boolean(filters.from || filters.to)} filter={<DateFilter filters={filters} updateParams={updateParams} />} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                        <Header label="Partner" field="partner" currentSort={currentSort} onSort={toggleSort} filterActive={filters.partnerId !== "all"} filter={<ChoiceFilter choices={[{ id: "all", name: "All partners" }, ...partners]} selected={filters.partnerId} onSelect={(value) => updateParams({ partnerId: value === "all" ? null : value })} />} icon={<User className="h-3.5 w-3.5" />} />
                        <Header label="Project" field="project" currentSort={currentSort} onSort={toggleSort} filterActive={filters.projectId !== "all"} filter={<ProjectFilter projects={projects} selected={filters.projectId} onSelect={(value) => updateParams({ projectId: value === "all" ? null : value })} />} icon={<Briefcase className="h-3.5 w-3.5" />} />
                        <Header label="Task" field="task" currentSort={currentSort} onSort={toggleSort} filterActive={Boolean(filters.taskQ)} filter={<TextFilter value={taskSearch} onChange={setTaskSearch} placeholder="Search tasks…" />} icon={<Search className="h-3.5 w-3.5" />} />
                        <Header label="Description" field="description" currentSort={currentSort} onSort={toggleSort} filterActive={Boolean(filters.descriptionQ)} filter={<TextFilter value={descriptionSearch} onChange={setDescriptionSearch} placeholder="Search descriptions…" />} icon={<FileText className="h-3.5 w-3.5" />} />
                        <Header label="Duration" field="duration" currentSort={currentSort} onSort={toggleSort} filterActive={Boolean(filters.minDuration || filters.maxDuration)} filter={<DurationFilter filters={filters} updateParams={updateParams} />} icon={<Clock className="h-3.5 w-3.5" />} align="right" />
                        <Header label="Source" field="source" currentSort={currentSort} onSort={toggleSort} filterActive={filters.source !== "all"} filter={<ChoiceFilter choices={[{ id: "all", name: "All sources" }, { id: "MANUAL", name: "Manual" }, { id: "TIMER", name: "Timer" }]} selected={filters.source} onSelect={(value) => updateParams({ source: value === "all" ? null : value })} />} icon={<Filter className="h-3.5 w-3.5" />} />
                        <Header label="Status" field="status" currentSort={currentSort} onSort={toggleSort} filterActive={filters.status !== "all"} filter={<ChoiceFilter choices={[{ id: "all", name: "All statuses" }, { id: "running", name: "Running" }, { id: "completed", name: "Completed" }]} selected={filters.status} onSelect={(value) => updateParams({ status: value === "all" ? null : value })} />} icon={<Filter className="h-3.5 w-3.5" />} />
                        <span className="ui-overline text-right">Action</span>
                    </div>

                    {logs.map((log, index) => {
                        const running = !log.endTime
                        return (
                            <div
                                key={log.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedLog(log)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLog(log) }
                                }}
                                className={cn("group stagger-row-enter grid min-h-14 cursor-pointer items-center gap-x-3 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-2 shadow-[var(--shadow-apple)] outline-none transition-colors hover:border-[color:color-mix(in_srgb,var(--brand-primary)_25%,var(--line-subtle))] focus-visible:ring-2 focus-visible:ring-[var(--ring)]", GRID)}
                                style={{ animationDelay: `${index * 0.025}s` }}
                            >
                                <div className="min-w-0 text-xs tabular-nums text-[var(--text-secondary)]">
                                    <p className="font-semibold text-[var(--text-primary)]">{format(new Date(log.startTime), "dd MMM yyyy")}</p>
                                    <p className="mt-0.5">{format(new Date(log.startTime), "HH:mm")}–{log.endTime ? format(new Date(log.endTime), "HH:mm") : "…"}</p>
                                </div>
                                <p className="truncate text-sm font-medium text-[var(--text-secondary)]">{log.project.site.partner.name}</p>
                                <p className="truncate text-sm font-bold text-[var(--text-primary)]" title={formatProjectName(log.project)}>{formatProjectName(log.project)}</p>
                                <p className="truncate text-sm text-[var(--text-secondary)]">{log.task?.name || "—"}</p>
                                <p className="truncate text-sm text-[var(--text-secondary)]" title={log.description || undefined}>{log.description || "—"}</p>
                                <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>{running ? <span className="text-sm font-bold text-emerald-600">Live</span> : <InlineDurationEdit seconds={log.durationSeconds} logId={log.id} />}</div>
                                <span className={cn("inline-flex w-fit rounded-md px-2 py-1 text-xs font-semibold", log.source === "TIMER" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-low)] text-[var(--text-secondary)]")}>{log.source === "TIMER" ? "Timer" : "Manual"}</span>
                                <span className={cn("inline-flex w-fit rounded-md px-2 py-1 text-xs font-semibold", running ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface-low)] text-[var(--text-secondary)]")}>{running ? "Running" : "Completed"}</span>
                                <div className="flex justify-end opacity-100 transition-opacity duration-200 xl:opacity-0 xl:group-hover:opacity-100">
                                    {running ? <Button size="icon-xs" variant="outline" onClick={(event) => void stop(event, log.id)} disabled={stoppingId === log.id} aria-label="Stop timer"><Square className="h-3.5 w-3.5 fill-current" /></Button> : <Button size="icon-xs" variant="ghost" onClick={(event) => void resume(event, log)} aria-label="Resume timer"><Play className="h-3.5 w-3.5 fill-current" /></Button>}
                                </div>
                            </div>
                        )
                    })}

                    {logs.length === 0 ? <ListEmptyState title="No time logs found" description="Try clearing one of the column filters." icon={<Clock className="h-5 w-5" />} className="py-16" /> : null}
                </div>
            </div>

            <TimeLogSheet log={selectedLog} open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)} projects={projects} tasks={tasks} panelStackLevel={0} />
        </div>
    )
}

function Header({ label, field, currentSort, onSort, filterActive, filter, icon, align = "left" }: { label: string; field: string; currentSort: string; onSort: (field: string) => void; filterActive: boolean; filter: React.ReactNode; icon: React.ReactNode; align?: "left" | "right" }) {
    return <div className={cn("flex min-w-0 items-center gap-1", align === "right" && "justify-end")}><button type="button" onClick={() => onSort(field)} className="ui-overline flex min-w-0 items-center gap-1 rounded px-1 py-1 hover:text-[var(--text-primary)]"><span className="truncate">{label}</span><ArrowDownUp className={cn("h-3 w-3 shrink-0", currentSort === field && "text-blue-600")} /></button><Popover><PopoverTrigger asChild><button type="button" aria-label={`Filter ${label}`} className={cn("relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)]", filterActive && "bg-blue-50 text-blue-600 after:absolute after:right-0.5 after:top-0.5 after:h-1.5 after:w-1.5 after:rounded-full after:bg-blue-500")}>{icon}</button></PopoverTrigger><PopoverContent align={align === "right" ? "end" : "start"} className="w-64 rounded-xl p-3">{filter}</PopoverContent></Popover></div>
}

function TextFilter({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
    return <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-9 pl-9 pr-9" autoFocus />{value ? <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)]" aria-label="Clear filter"><X className="h-3.5 w-3.5" /></button> : null}</div>
}

function ChoiceFilter({ choices, selected, onSelect }: { choices: Array<{ id: string; name: string }>; selected: string; onSelect: (value: string) => void }) {
    return <div className="max-h-72 overflow-y-auto">{choices.map((choice) => <button key={choice.id} type="button" onClick={() => onSelect(choice.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--surface-low)]"><Check className={cn("h-4 w-4 text-blue-600", selected !== choice.id && "opacity-0")} /><span className="truncate">{choice.name}</span></button>)}</div>
}

function ProjectFilter({ projects, selected, onSelect }: { projects: ProjectOption[]; selected: string; onSelect: (value: string) => void }) {
    const [query, setQuery] = React.useState("")
    const visible = projects.filter((project) => project.displayName.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 100)
    return <div className="space-y-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects…" className="h-9" autoFocus /><ChoiceFilter choices={[{ id: "all", name: "All projects" }, ...visible.map((project) => ({ id: project.id, name: project.displayName }))]} selected={selected} onSelect={onSelect} /></div>
}

function DateFilter({ filters, updateParams }: { filters: TimeLogFilters; updateParams: (updates: Record<string, string | null>) => void }) {
    return <div className="space-y-3"><label className="block text-xs font-semibold text-[var(--text-secondary)]">From<input type="date" value={filters.from} onChange={(event) => updateParams({ from: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-sm" /></label><label className="block text-xs font-semibold text-[var(--text-secondary)]">To<input type="date" value={filters.to} onChange={(event) => updateParams({ to: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2 text-sm" /></label>{filters.from || filters.to ? <Button variant="ghost" size="sm" className="w-full" onClick={() => updateParams({ from: null, to: null })}>Clear dates</Button> : null}</div>
}

function DurationFilter({ filters, updateParams }: { filters: TimeLogFilters; updateParams: (updates: Record<string, string | null>) => void }) {
    const [minimum, setMinimum] = React.useState(filters.minDuration)
    const [maximum, setMaximum] = React.useState(filters.maxDuration)
    React.useEffect(() => setMinimum(filters.minDuration), [filters.minDuration])
    React.useEffect(() => setMaximum(filters.maxDuration), [filters.maxDuration])
    return <div className="space-y-3"><label className="block text-xs font-semibold text-[var(--text-secondary)]">Minimum minutes<Input type="number" min="0" value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-1 h-9" /></label><label className="block text-xs font-semibold text-[var(--text-secondary)]">Maximum minutes<Input type="number" min="0" value={maximum} onChange={(event) => setMaximum(event.target.value)} className="mt-1 h-9" /></label><div className="flex gap-2"><Button variant="ghost" size="sm" className="flex-1" onClick={() => { setMinimum(""); setMaximum(""); updateParams({ minDuration: null, maxDuration: null }) }}>Clear</Button><Button size="sm" className="flex-1" onClick={() => updateParams({ minDuration: minimum || null, maxDuration: maximum || null })}>Apply</Button></div></div>
}

function InlineDurationEdit({ seconds, logId }: { seconds: number | null; logId: string }) {
    const [editing, setEditing] = React.useState(false)
    const [value, setValue] = React.useState("")
    const label = formatDuration(seconds)

    const save = async () => {
        const nextSeconds = parseDuration(value)
        if (nextSeconds !== null && nextSeconds !== seconds) {
            const result = await updateTimeLog(logId, { durationSeconds: nextSeconds, source: "MANUAL" })
            if (result.success) toast.success("Duration updated")
            else toast.error(result.error || "Failed to update duration")
        }
        setEditing(false)
    }

    if (editing) return <Input autoFocus value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => void save()} onKeyDown={(event) => { if (event.key === "Enter") void save(); if (event.key === "Escape") setEditing(false) }} className="h-7 w-24 px-1 text-right font-mono text-xs" />
    return <button type="button" onClick={() => { setEditing(true); setValue(label) }} className="rounded px-1 py-0.5 font-mono text-sm font-semibold tabular-nums hover:bg-[var(--surface-low)]">{label}</button>
}

function formatDuration(seconds: number | null) {
    if (seconds === null) return "—"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remaining = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`
}

function parseDuration(input: string) {
    const clean = input.toLowerCase().trim()
    if (!clean) return null
    if (clean.includes(":")) {
        const parts = clean.split(":").map(Number)
        if (parts.some(Number.isNaN)) return null
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
        if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
        return null
    }
    let seconds = 0
    const sections = clean.match(/(\d+(?:\.\d+)?)([hm])/g)
    if (sections) {
        for (const section of sections) seconds += Number.parseFloat(section) * (section.includes("h") ? 3600 : 60)
        return Math.floor(seconds)
    }
    const minutes = Number.parseFloat(clean)
    return Number.isNaN(minutes) ? null : Math.floor(minutes * 60)
}
