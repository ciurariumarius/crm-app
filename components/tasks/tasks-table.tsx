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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { updateTask, toggleTaskStatus } from "@/lib/actions"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Clock, Users, Globe, ExternalLink, Target } from "lucide-react"
import { TaskDetails } from "./task-details"
import { useTimer } from "@/components/providers/timer-provider"

interface TasksTableProps {
    tasks: any[]
}

export function TasksTable({ tasks }: TasksTableProps) {
    const { timerState } = useTimer()
    const [selectedTask, setSelectedTask] = React.useState<any>(null)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)

    const handleStatusChange = async (taskId: string, currentStatus: string, projectId: string) => {
        setUpdatingId(taskId)
        try {
            await toggleTaskStatus(taskId, currentStatus, projectId)
            toast.success("Task status updated")
        } catch (error) {
            toast.error("Failed to update status")
        } finally {
            setUpdatingId(null)
        }
    }

    const handleUpdate = async (taskId: string, data: any) => {
        setUpdatingId(taskId)
        try {
            await updateTask(taskId, data)
            toast.success("Task updated")
        } catch (error) {
            toast.error("Failed to update task")
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <div className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-primary/5">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="w-[300px]">Task Name</TableHead>
                        <TableHead>Project / Partner</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="w-[160px]">Deadline</TableHead>
                        <TableHead className="w-[140px]">Duration</TableHead>
                        <TableHead className="w-[160px]">Last Update</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map((task) => (
                        <TableRow
                            key={task.id}
                            className="group transition-colors cursor-pointer"
                        >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={task.isCompleted}
                                    onCheckedChange={() => handleStatusChange(task.id, task.status, task.projectId)}
                                    disabled={updatingId === task.id}
                                />
                            </TableCell>
                            <TableCell onClick={() => setSelectedTask(task)}>
                                <div className="flex flex-col gap-0.5">
                                    <span className={cn(
                                        "font-semibold text-sm group-hover:text-primary transition-colors",
                                        task.isCompleted && "line-through text-muted-foreground opacity-60"
                                    )}>
                                        {task.name}
                                    </span>
                                    {task.description && (
                                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                                            {task.description}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell onClick={() => setSelectedTask(task)}>
                                <div className="flex flex-col gap-1 max-w-[200px]">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                        <Users className="h-3 w-3 opacity-50 shrink-0" />
                                        <span className="truncate">{task.project.site.partner.name}</span>
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-black flex items-center gap-2">
                                        <Globe className="h-3 w-3 opacity-30 shrink-0" />
                                        <span className="truncate">{task.project.site.domainName}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Select
                                    defaultValue={task.status}
                                    onValueChange={(val) => handleUpdate(task.id, { status: val })}
                                    disabled={updatingId === task.id}
                                >
                                    <SelectTrigger className={cn(
                                        "h-8 text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-muted/50 p-1 w-[120px]",
                                        task.status === "Completed" ? "text-emerald-500" :
                                            task.status === "Active" ? "text-blue-500" : "text-orange-500"
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active" className="text-[10px] font-black uppercase tracking-widest text-blue-500">ACTIVE</SelectItem>
                                        <SelectItem value="Paused" className="text-[10px] font-black uppercase tracking-widest text-orange-500">PAUSED</SelectItem>
                                        <SelectItem value="Completed" className="text-[10px] font-black uppercase tracking-widest text-emerald-500">COMPLETED</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell onClick={() => setSelectedTask(task)}>
                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                    <CalendarIcon className={cn(
                                        "h-3 w-3",
                                        task.deadline && new Date(task.deadline) < new Date() && !task.isCompleted ? "text-rose-500" : "text-muted-foreground"
                                    )} />
                                    {task.deadline ? (
                                        <span className={cn(
                                            task.deadline && new Date(task.deadline) < new Date() && !task.isCompleted ? "text-rose-500" : "text-muted-foreground"
                                        )}>
                                            {format(new Date(task.deadline), "MMM dd, yyyy")}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground/30 italic">No deadline</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell onClick={() => setSelectedTask(task)}>
                                {(() => {
                                    const logsDuration = task.timeLogs?.reduce((acc: number, log: any) => acc + (log.durationSeconds || 0), 0) || 0
                                    const currentTimerDuration = timerState.taskId === task.id ? timerState.elapsedSeconds : 0
                                    const totalSeconds = logsDuration + currentTimerDuration
                                    const hasTimeLogs = totalSeconds > 0
                                    const useFallback = task.isCompleted && !hasTimeLogs && task.estimatedMinutes

                                    if (!hasTimeLogs && !useFallback) {
                                        if (task.estimatedMinutes) {
                                            return (
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold opacity-60">
                                                    <Target className="h-3 w-3 opacity-50" />
                                                    <span>Est: {task.estimatedMinutes >= 60 ? `${Math.floor(task.estimatedMinutes / 60)}h ${task.estimatedMinutes % 60}m` : `${task.estimatedMinutes}m`}</span>
                                                </div>
                                            )
                                        }
                                        return <span className="text-[10px] text-muted-foreground/30 italic">No tracking</span>
                                    }

                                    const displaySeconds = useFallback ? (task.estimatedMinutes * 60) : totalSeconds
                                    const hours = Math.floor(displaySeconds / 3600)
                                    const mins = Math.floor((displaySeconds % 3600) / 60)

                                    return (
                                        <div className={cn(
                                            "flex items-center gap-2 text-[10px] font-bold",
                                            useFallback ? "text-amber-600" : (timerState.taskId === task.id && timerState.isRunning ? "text-primary animate-pulse" : "text-emerald-600")
                                        )}>
                                            {useFallback ? <Target className="h-3 w-3 opacity-50" /> : <Clock className="h-3 w-3 opacity-50" />}
                                            <span>{hours}h {mins}m {useFallback ? "(Est)" : ""}</span>
                                        </div>
                                    )
                                })()}
                            </TableCell>
                            <TableCell onClick={() => setSelectedTask(task)}>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                    <Clock className="h-3 w-3 opacity-50" />
                                    {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {tasks.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground font-medium italic opacity-50">
                                No tasks found matching your criteria.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table >

            <TaskDetails
                task={selectedTask}
                open={!!selectedTask}
                onOpenChange={(open) => !open && setSelectedTask(null)}
            />
        </div >
    )
}
