"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Loader2, SlidersHorizontal } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { addTask } from "@/lib/actions/tasks"
import { formatProjectName } from "@/lib/utils"
import { MAX_TASK_ESTIMATED_MINUTES, parseTaskEstimatedMinutesInput } from "@/lib/tasks/estimated-time"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { TaskLmsFields, TaskTargetSelector, type TaskScopeValue } from "@/components/tasks/task-target-fields"

export interface TaskDialogProject {
    id: string
    status: string
    siteName?: string
    site?: { domainName?: string }
    services?: { serviceName: string; isRecurring?: boolean }[]
    createdAt?: Date | string
}

interface GlobalCreateTaskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projects: TaskDialogProject[]
}

const DEFAULT_TASK_SCOPE: TaskScopeValue = "FREELANCE"

export function GlobalCreateTaskDialog({ open, onOpenChange, projects }: GlobalCreateTaskDialogProps) {
    const router = useRouter()
    const nameInputRef = React.useRef<HTMLInputElement>(null)
    const [name, setName] = React.useState("")
    const [selectedProjectId, setSelectedProjectId] = React.useState("")
    const [taskScope, setTaskScope] = React.useState<TaskScopeValue>(DEFAULT_TASK_SCOPE)
    const [lmsAllocationId, setLmsAllocationId] = React.useState("")
    const [lmsTaskTypeId, setLmsTaskTypeId] = React.useState("")
    const [status, setStatus] = React.useState("Active")
    const [urgency, setUrgency] = React.useState("Medium")
    const [estimatedMinutes, setEstimatedMinutes] = React.useState("")
    const [isLoading, setIsLoading] = React.useState(false)
    const [showCompleted, setShowCompleted] = React.useState(false)
    const [projectOpen, setProjectOpen] = React.useState(false)
    const [showDetails, setShowDetails] = React.useState(false)
    const [touched, setTouched] = React.useState({ name: false, project: false, minutes: false })

    const displayProjects = React.useMemo(
        () => [...projects]
            .filter((project) => showCompleted || project.status === "Active")
            .sort((a, b) => {
                if (a.status === "Active" && b.status !== "Active") return -1
                if (a.status !== "Active" && b.status === "Active") return 1
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                return dateB - dateA
            }),
        [projects, showCompleted]
    )
    const parsedEstimatedMinutes = parseTaskEstimatedMinutesInput(estimatedMinutes)
    const nameInvalid = !name.trim()
    const projectInvalid = taskScope === "FREELANCE" && !selectedProjectId
    const minutesInvalid = parsedEstimatedMinutes === undefined
    const formValid = !nameInvalid && !projectInvalid && !minutesInvalid

    const resetForm = React.useCallback(() => {
        setName("")
        setSelectedProjectId("")
        setTaskScope(DEFAULT_TASK_SCOPE)
        setLmsAllocationId("")
        setLmsTaskTypeId("")
        setStatus("Active")
        setUrgency("Medium")
        setEstimatedMinutes("")
        setShowCompleted(false)
        setProjectOpen(false)
        setShowDetails(false)
        setTouched({ name: false, project: false, minutes: false })
    }, [])

    const changeDialogOpen = (nextOpen: boolean) => {
        if (!nextOpen && !isLoading) resetForm()
        onOpenChange(nextOpen)
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setTouched({ name: true, project: true, minutes: true })
        if (!formValid || isLoading) return

        setIsLoading(true)
        try {
            const result = await addTask(taskScope === "FREELANCE" ? selectedProjectId : undefined, name.trim(), {
                status: taskScope === "LMS" ? "Active" : status,
                urgency,
                estimatedMinutes: parsedEstimatedMinutes ?? undefined,
                taskScope,
                lmsAllocationId: taskScope === "LMS" ? lmsAllocationId || null : null,
                lmsTaskTypeId: taskScope === "LMS" ? lmsTaskTypeId || null : null,
            })

            if (!result.success) {
                toast.error(result.error || "Failed to create task")
                return
            }

            toast.success(taskScope === "LMS" ? "LMS task created" : "Task created")
            resetForm()
            onOpenChange(false)
            router.refresh()
        } catch {
            toast.error("Failed to create task")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={changeDialogOpen}>
            <DialogContent className="flex max-h-[min(90dvh,760px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-[22px] border-[var(--line-subtle)] p-0 shadow-2xl sm:max-w-[560px]">
                <DialogHeader className="shrink-0 border-b border-[var(--line-subtle)] px-5 py-4 sm:px-6">
                    <DialogTitle className="text-xl font-bold tracking-tight">Add task</DialogTitle>
                    <DialogDescription className="sr-only">Create a Freelance or LMS task.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6" data-slot="create-task-form-scroll-area">
                        <div className="space-y-2">
                            <Label htmlFor="new-task-name" className="text-xs font-semibold text-[var(--text-secondary)]">Task name *</Label>
                            <Input
                                ref={nameInputRef}
                                id="new-task-name"
                                autoFocus
                                placeholder="What needs to be done?"
                                className={cn(
                                    "h-12 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 font-semibold shadow-none focus-visible:ring-1 focus-visible:ring-primary/20",
                                    touched.name && nameInvalid && "border-[var(--state-urgent)]"
                                )}
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                                aria-invalid={touched.name && nameInvalid}
                                aria-describedby={touched.name && nameInvalid ? "new-task-name-error" : undefined}
                                disabled={isLoading}
                            />
                            {touched.name && nameInvalid ? <p id="new-task-name-error" className="text-xs font-medium text-[var(--state-urgent)]">Enter a task name.</p> : null}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-[var(--text-secondary)]">Type</Label>
                            <TaskTargetSelector
                                value={taskScope}
                                onValueChange={(value) => {
                                    setTaskScope(value)
                                    setTouched((current) => ({ ...current, project: false }))
                                    if (value === "LMS") setStatus("Active")
                                }}
                                disabled={isLoading}
                                compact
                            />
                        </div>

                        {taskScope === "FREELANCE" ? (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-[var(--text-secondary)]">Freelance project *</Label>
                                <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-label="Select freelance project"
                                            aria-expanded={projectOpen}
                                            aria-invalid={touched.project && projectInvalid}
                                            onBlur={() => setTouched((current) => ({ ...current, project: true }))}
                                            className={cn(
                                                "h-12 w-full justify-between rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-left font-semibold shadow-none focus:ring-1 focus:ring-primary/20",
                                                touched.project && projectInvalid && "border-[var(--state-urgent)]"
                                            )}
                                            disabled={isLoading}
                                        >
                                            <span className={cn("truncate pr-4", !selectedProjectId && "font-normal text-[var(--text-muted)]")}>
                                                {selectedProjectId
                                                    ? formatProjectName(projects.find((project) => project.id === selectedProjectId) || {})
                                                    : "Select a project"}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="start"
                                        collisionPadding={16}
                                        className="w-[var(--radix-popover-trigger-width)] min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
                                        onWheelCapture={(event) => event.stopPropagation()}
                                        onTouchMoveCapture={(event) => event.stopPropagation()}
                                    >
                                        <Command className="flex min-h-0 flex-col">
                                            <CommandInput placeholder="Search projects…" />
                                            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-subtle)] px-3 py-2">
                                                <Label htmlFor="include-inactive-projects" className="text-xs font-medium text-[var(--text-secondary)]">Include inactive</Label>
                                                <Switch id="include-inactive-projects" checked={showCompleted} onCheckedChange={setShowCompleted} className="scale-75 origin-right" />
                                            </div>
                                            <CommandList className="max-h-[min(300px,calc(var(--radix-popover-content-available-height)-6rem))] touch-pan-y overflow-y-auto overscroll-contain">
                                                <CommandEmpty>No project found.</CommandEmpty>
                                                <CommandGroup>
                                                    {displayProjects.map((project) => (
                                                        <CommandItem
                                                            key={project.id}
                                                            value={`${formatProjectName(project)} ${project.id}`}
                                                            onSelect={() => {
                                                                setSelectedProjectId(project.id)
                                                                setTouched((current) => ({ ...current, project: true }))
                                                                setProjectOpen(false)
                                                                window.requestAnimationFrame(() => nameInputRef.current?.focus())
                                                            }}
                                                            className="min-h-10"
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedProjectId === project.id ? "opacity-100" : "opacity-0")} />
                                                            <span className="min-w-0 flex-1 truncate">{formatProjectName(project)}</span>
                                                            {project.status !== "Active" ? <span className="ml-2 shrink-0 text-xs font-semibold text-[var(--text-muted)]">{project.status}</span> : null}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {touched.project && projectInvalid ? <p className="text-xs font-medium text-[var(--state-urgent)]">Select a freelance project.</p> : null}
                            </div>
                        ) : null}

                        {taskScope === "LMS" ? (
                            <TaskLmsFields
                                lmsAllocationId={lmsAllocationId}
                                lmsTaskTypeId={lmsTaskTypeId}
                                onAllocationChange={setLmsAllocationId}
                                onWorkTaskChange={setLmsTaskTypeId}
                                disabled={isLoading}
                                compact
                            />
                        ) : null}

                        <div className="space-y-2">
                            <Label htmlFor="new-task-estimated-minutes" className="text-xs font-semibold text-[var(--text-secondary)]">Time (min)</Label>
                            <Input
                                id="new-task-estimated-minutes"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={MAX_TASK_ESTIMATED_MINUTES}
                                step={1}
                                placeholder="30"
                                className={cn(
                                    "h-12 rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 font-semibold shadow-none focus-visible:ring-1 focus-visible:ring-primary/20",
                                    touched.minutes && minutesInvalid && "border-[var(--state-urgent)]"
                                )}
                                value={estimatedMinutes}
                                onChange={(event) => setEstimatedMinutes(event.target.value)}
                                onBlur={() => setTouched((current) => ({ ...current, minutes: true }))}
                                aria-invalid={touched.minutes && minutesInvalid}
                                aria-describedby={touched.minutes && minutesInvalid ? "new-task-minutes-error" : undefined}
                                disabled={isLoading}
                            />
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {[30, 60, 90, 120, 180, 240].map((mins) => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => {
                                            setEstimatedMinutes(String(mins))
                                            setTouched((current) => ({ ...current, minutes: true }))
                                        }}
                                        className={cn(
                                            "rounded-lg border px-2.5 py-1 text-xs font-semibold transition active:scale-[0.97]",
                                            estimatedMinutes === String(mins)
                                                ? "border-[var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,var(--surface-lowest))] text-[var(--brand-primary)] font-bold"
                                                : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] hover:bg-[var(--surface-low)]"
                                        )}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                            </div>
                            {touched.minutes && minutesInvalid ? (
                                <p id="new-task-minutes-error" className="text-xs font-medium text-[var(--state-urgent)]">Use 1–{MAX_TASK_ESTIMATED_MINUTES} minutes, or leave it empty.</p>
                            ) : null}
                        </div>

                        <div>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowDetails((current) => !current)}
                                className="h-11 w-full justify-between rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                aria-expanded={showDetails}
                            >
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    More options
                                </span>
                                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                        </div>

                        {showDetails ? (
                            <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 sm:grid-cols-2">
                                {taskScope === "FREELANCE" ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-[var(--text-secondary)]">Status</Label>
                                        <Select value={status} onValueChange={setStatus} disabled={isLoading}>
                                            <SelectTrigger className="h-11 w-full rounded-xl shadow-none"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Active">Active</SelectItem>
                                                <SelectItem value="Completed">Completed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null}

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-[var(--text-secondary)]">Priority</Label>
                                    <Select value={urgency} onValueChange={setUrgency} disabled={isLoading}>
                                        <SelectTrigger className="h-11 w-full rounded-xl shadow-none"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="Low">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter className="shrink-0 border-t border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-5 py-4 sm:px-6">
                        <Button
                            type="submit"
                            disabled={isLoading || !formValid}
                            className="h-12 w-full rounded-xl font-bold shadow-md shadow-primary/10"
                        >
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            {isLoading ? "Creating…" : "Create task"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
