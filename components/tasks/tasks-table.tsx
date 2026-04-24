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
import { normalizeTaskStatus } from "@/lib/status"
import { updateTask, toggleTaskStatus } from "@/lib/actions/tasks"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Clock, Users, Globe, Target } from "lucide-react"
import { TaskDetails, type TaskDetailsTask } from "./task-details"
import { useTimer } from "@/components/providers/timer-provider"

type TaskTableTimeLog = {
    durationSeconds?: number | null
}

type TaskTableTask = TaskDetailsTask & {
    projectId: string
    name: string
    status: string
    project: {
        site: {
            domainName: string
            partner: {
                name: string
            }
        }
    }
    timeLogs?: TaskTableTimeLog[] | null
    estimatedMinutes?: number | null
    deadline?: string | Date | null
    updatedAt?: string | Date | null
}

interface TasksTableProps {
    tasks: TaskTableTask[]
}

export function TasksTable({ tasks }: TasksTableProps) {
    const { timerState } = useTimer()
    const [selectedTask, setSelectedTask] = React.useState<TaskTableTask | null>(null)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)

    const handleStatusChange = async (taskId: string, currentStatus: string, projectId: string) => {
        setUpdatingId(taskId)
        try {
            await toggleTaskStatus(taskId, currentStatus, projectId)
            toast.success("Task status updated")
        } catch {
            toast.error("Failed to update status")
        } finally {
            setUpdatingId(null)
        }
    }

    const handleUpdate = async (taskId: string, data: { status?: string }) => {
        setUpdatingId(taskId)
        try {
            await updateTask(taskId, data)
            toast.success("Task updated")
        } catch {
            toast.error("Failed to update task")
        } finally {
            setUpdatingId(null)
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
                            <TableHead className="w-[160px]">Deadline</TableHead>
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
                                        onCheckedChange={() => handleStatusChange(task.id, task.status, task.projectId)}
                                        disabled={updatingId === task.id}
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
                                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70">
                                            <Users className="h-3 w-3 opacity-50 shrink-0" />
                                            <span className="truncate">{task.project.site.partner.name}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground/60 font-medium flex items-center gap-2">
                                            <Globe className="h-3 w-3 opacity-40 shrink-0" />
                                            <span className="truncate">{task.project.site.domainName}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Select
                                        defaultValue={normalizeTaskStatus(task.status)}
                                        onValueChange={(val) => handleUpdate(task.id, { status: val })}
                                        disabled={updatingId === task.id}
                                    >
                                        <SelectTrigger className={cn(
                                            "h-8 text-xs font-medium border-none bg-transparent hover:bg-muted/50 p-1 w-[120px]",
                                            task.status === "Completed" ? "text-emerald-600" :
                                                task.status === "Active" ? "text-blue-600" : "text-[var(--text-secondary)]"
                                        )}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active" className="text-xs font-medium text-blue-600">Active</SelectItem>
                                            <SelectItem value="Completed" className="text-xs font-medium text-emerald-600">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)} className="cell-tech">
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        <CalendarIcon className={cn(
                                            "h-3 w-3",
                                            task.deadline && new Date(task.deadline) < new Date() && task.status !== "Completed" ? "text-rose-500" : "text-muted-foreground"
                                        )} />
                                        {task.deadline ? (
                                            <span className={cn(
                                                task.deadline && new Date(task.deadline) < new Date() && task.status !== "Completed" ? "text-rose-500" : "text-muted-foreground"
                                            )}>
                                                {formatRelativeDate(task.deadline)}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground/30 italic">No deadline</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell onClick={() => setSelectedTask(task)} className="cell-financial">
                                    {(() => {
                                        const logsDuration = task.timeLogs?.reduce((acc: number, log: TaskTableTimeLog) => acc + (log.durationSeconds || 0), 0) || 0
                                        const currentTimerDuration = timerState.taskId === task.id ? timerState.elapsedSeconds : 0
                                        const totalSeconds = logsDuration + currentTimerDuration
                                        const hasTimeLogs = totalSeconds > 0
                                        const useFallback = task.status === "Completed" && !hasTimeLogs && task.estimatedMinutes

                                        if (!hasTimeLogs && !useFallback) {
                                            if (task.estimatedMinutes) {
                                                return (
                                                    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground font-medium opacity-80">
                                                        <Target className="h-3 w-3 opacity-50" />
                                                        <span>Est: {task.estimatedMinutes >= 60 ? `${Math.floor(task.estimatedMinutes / 60)}h ${task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ''}` : `${task.estimatedMinutes}m`}</span>
                                                    </div>
                                                )
                                            }
                                            return <span className="text-xs text-muted-foreground/50 italic">No tracking</span>
                                        }

                                        const displaySeconds = useFallback ? ((task.estimatedMinutes ?? 0) * 60) : totalSeconds
                                        const hours = Math.floor(displaySeconds / 3600)
                                        const mins = Math.floor((displaySeconds % 3600) / 60)

                                        return (
                                            <div className={cn(
                                                "flex items-center justify-end gap-2 text-xs font-medium",
                                                useFallback ? "text-amber-600" : (timerState.taskId === task.id && timerState.isRunning ? "text-primary animate-pulse font-bold" : "text-emerald-600")
                                            )}>
                                                {useFallback ? <Target className="h-3 w-3 opacity-50" /> : <Clock className="h-3 w-3 opacity-50" />}
                                                <span>{hours}h {mins}m {useFallback ? "(Est)" : ""}</span>
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
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
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
