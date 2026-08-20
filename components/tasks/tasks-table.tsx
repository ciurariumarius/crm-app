"use client"

import * as React from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn, formatRelativeDate } from "@/lib/utils"
import { normalizeTaskStatus, normalizeTaskUrgency } from "@/lib/status"
import { Clock, Users, Globe, Target } from "lucide-react"
import { TaskDetails, type TaskDetailsTask } from "./task-details"
import { useTimer } from "@/components/providers/timer-provider"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import { LmsIcon } from "@/components/lms/lms-icon"

type TaskTableTimeLog = {
    durationSeconds?: number | null
}

type TaskTableTask = TaskDetailsTask & {
    projectId?: string | null
    name: string
    status: string
    project?: {
        site?: {
            domainName?: string | null
            partner?: {
                name?: string | null
            } | null
        } | null
    } | null
    timeLogs?: TaskTableTimeLog[] | null
    estimatedMinutes?: number | null
    lmsWorkEntry?: { durationMinutes?: number | null } | null
    deadline?: string | Date | null
    updatedAt?: string | Date | null
}

import { updateTasksStatus } from "@/lib/actions/tasks"

interface TasksTableProps {
    tasks: TaskTableTask[]
}

export function TasksTable({ tasks }: TasksTableProps) {
    const { timerState } = useTimer()
    const { requestCompletion, requestReopen, pendingTaskId } = useTaskCompletion()
    const [selectedTask, setSelectedTask] = React.useState<TaskTableTask | null>(null)

    React.useEffect(() => {
        setSelectedTask((current) => {
            if (!current) return current
            return tasks.find((task) => task.id === current.id) || current
        })
    }, [tasks])

    const handleStatusChange = async (task: TaskTableTask, nextStatus?: string) => {
        if (nextStatus === "Completed" || nextStatus === "Done") {
            if (task.status !== "Completed") requestCompletion(task)
        } else if (nextStatus === "Pending") {
            if (task.status === "Completed") {
                const reopened = await requestReopen(task)
                if (reopened) {
                    await updateTasksStatus([task.id], "Pending")
                }
            } else if (task.status !== "Pending") {
                await updateTasksStatus([task.id], "Pending")
            }
        } else {
            if (task.status === "Completed") {
                void requestReopen(task)
            } else if (task.status !== "Active") {
                await updateTasksStatus([task.id], "Active")
            }
        }
    }

    return (
        <div className="glass rounded-xl overflow-hidden apple-shadow">
            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                <Table className="table-cockpit">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[300px]">Task Name</TableHead>
                            <TableHead>Project / Partner</TableHead>
                            <TableHead className="w-[140px]">Status</TableHead>
                            <TableHead className="w-[120px]">Priority</TableHead>
                            <TableHead className="w-[140px] text-right">Duration</TableHead>
                            <TableHead className="w-[160px] text-right">Last Update</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.map((task, index) => (
                            <TableRow
                                key={task.id}
                                className="group transition-colors cursor-pointer stagger-row-enter"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={task.status === "Completed"}
                                        onCheckedChange={() => handleStatusChange(task)}
                                        disabled={pendingTaskId === task.id}
                                    />
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)}>
                                    <div className="flex flex-col gap-0.5">
                                        <span className={cn(
                                            "font-semibold text-sm group-hover:text-primary transition-colors",
                                            task.status === "Completed" && "line-through text-muted-foreground opacity-60"
                                        )}>
                                            {task.name}
                                        </span>
                                        {task.description && (
                                            <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                                {task.description}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)}>
                                    <div className="flex flex-col gap-1 max-w-[200px]">
                                        {task.taskScope === "LMS" ? <>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">
                                                <LmsIcon className="h-4 w-4" />
                                                <span className="truncate">LMS · {task.lmsAllocation?.client || "Project not linked"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/60">
                                                <Target className="h-3 w-3 shrink-0 opacity-50" />
                                                <span className="truncate">{task.lmsTaskType?.name || "Category not linked"}</span>
                                            </div>
                                        </> : <>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70">
                                                <Users className="h-3 w-3 shrink-0 opacity-50" />
                                                <span className="truncate">{task.project?.site?.partner?.name || "No partner"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/60">
                                                <Globe className="h-3 w-3 shrink-0 opacity-40" />
                                                <span className="truncate">{task.project?.site?.domainName || "No domain"}</span>
                                            </div>
                                        </>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        value={normalizeTaskStatus(task.status)}
                                        onValueChange={(val) => void handleStatusChange(task, val)}
                                        disabled={pendingTaskId === task.id}
                                    >
                                        <SelectTrigger className={cn(
                                            "h-8 text-xs font-medium border-none bg-transparent hover:bg-muted/50 p-1 w-[120px]",
                                            (task.status === "Completed" || task.status === "Done") ? "text-emerald-600" :
                                                (task.status === "Pending" || task.status === "Paused") ? "text-amber-600" :
                                                task.status === "Active" ? "text-blue-600" : "text-[var(--text-secondary)]"
                                        )}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active" className="text-xs font-medium text-blue-600">Active</SelectItem>
                                            <SelectItem value="Pending" className="text-xs font-medium text-amber-600">Pending</SelectItem>
                                            <SelectItem value="Completed" className="text-xs font-medium text-emerald-600">Done</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)}>
                                    {(() => {
                                        const priority = normalizeTaskUrgency(task.urgency)
                                        const pillClass = priority === "High"
                                            ? "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 font-semibold"
                                            : priority === "Low"
                                              ? "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400 font-medium"
                                              : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-medium"
                                        const dotClass = priority === "High" ? "bg-rose-500" : priority === "Low" ? "bg-zinc-400" : "bg-amber-500"
                                        return (
                                            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", pillClass)}>
                                                <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
                                                <span>{priority}</span>
                                            </span>
                                        )
                                    })()}
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)} className="cell-financial">
                                    {(() => {
                                        const sessionDuration = task.timeLogs?.reduce((acc: number, log: TaskTableTimeLog) => acc + (log.durationSeconds || 0), 0) || 0
                                        const logsDuration = sessionDuration > 0
                                            ? sessionDuration
                                            : Math.max(0, task.lmsWorkEntry?.durationMinutes || 0) * 60
                                        const currentTimerDuration = timerState.taskId === task.id ? timerState.elapsedSeconds : 0
                                        const totalSeconds = logsDuration + currentTimerDuration

                                        if (totalSeconds <= 0) {
                                            return <span className="text-xs text-muted-foreground/50 italic">0m</span>
                                        }

                                        const hours = Math.floor(totalSeconds / 3600)
                                        const mins = Math.floor((totalSeconds % 3600) / 60)
                                        const timeText = hours > 0 && mins > 0 ? `${hours}h ${mins}m` : hours > 0 ? `${hours}h` : `${mins}m`

                                        return (
                                            <div className={cn(
                                                "flex items-center justify-end gap-2 text-xs font-medium",
                                                timerState.taskId === task.id && timerState.isRunning ? "text-primary animate-pulse font-bold" : "text-emerald-600"
                                            )}>
                                                <Clock className="h-3 w-3 opacity-50" />
                                                <span>{timeText}</span>
                                            </div>
                                        )
                                    })()}
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)} className="cell-tech text-right">
                                    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground font-medium">
                                        <Clock className="h-3 w-3 opacity-50" />
                                        {formatRelativeDate(task.updatedAt)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {tasks.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center">
                                    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                                            <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                                        </div>
                                        <p className="mt-3 text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                                            No matching tasks
                                        </p>
                                        <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                                            Try a different search term or adjust the current filters.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table >
            </div>

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />
        </div >
    )
}
