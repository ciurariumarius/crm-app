"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format, isToday, isTomorrow, isPast, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar, AlertCircle, Clock, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { updateTask } from "@/lib/actions"
import { toast } from "sonner"

interface UpcomingTasksProps {
    tasks: any[]
}

export function UpcomingTasks({ tasks }: UpcomingTasksProps) {
    const [optimisticTasks, setOptimisticTasks] = React.useOptimistic(
        tasks,
        (state, updatedTask: string) => state.filter((task) => task.id !== updatedTask)
    )

    const handleComplete = async (taskId: string) => {
        // Optimistically remove
        React.startTransition(() => {
            setOptimisticTasks(taskId)
        })

        try {
            const result = await updateTask(taskId, { isCompleted: true, status: 'Completed' })
            if (result.success) {
                toast.success("Task completed")
            } else {
                toast.error("Failed to complete task")
            }
        } catch (error) {
            toast.error("An error occurred")
        }
    }

    const getDeadlineColor = (date: Date) => {
        if (isPast(date) && !isToday(date)) return "text-rose-500 font-bold"
        if (isToday(date)) return "text-orange-500 font-bold"
        if (isTomorrow(date)) return "text-amber-500 font-medium"
        return "text-muted-foreground/60"
    }

    const getDeadlineText = (date: Date) => {
        if (isPast(date) && !isToday(date)) return "Overdue"
        if (isToday(date)) return "Today"
        if (isTomorrow(date)) return "Tomorrow"
        return format(date, "MMM d")
    }

    return (
        <Card className="h-full border-border bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between bg-card/80">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Upcoming & Urgent
                </CardTitle>
                <Link href="/tasks">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground">
                        View All
                        <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                </Link>
            </CardHeader>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {optimisticTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50 gap-2">
                            <CheckCircle2 className="h-8 w-8 opacity-20" />
                            <span className="text-xs font-medium">All caught up!</span>
                        </div>
                    ) : (
                        optimisticTasks.map((task) => (
                            <div
                                key={task.id}
                                className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                            >
                                <Checkbox
                                    className="mt-1 rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
                                    onCheckedChange={() => handleComplete(task.id)}
                                />
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium leading-snug truncate pr-2 group-hover:text-primary transition-colors">
                                            {task.name}
                                        </p>
                                        {task.deadline && (
                                            <div className={cn("text-[10px] shrink-0 flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded-md", getDeadlineColor(new Date(task.deadline)))}>
                                                {new Date(task.deadline) < new Date() && <AlertCircle className="h-3 w-3" />}
                                                {getDeadlineText(new Date(task.deadline))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                                        <span className="truncate max-w-[120px] font-medium text-foreground/70">
                                            {task.project.name || task.project.site.domainName}
                                        </span>
                                        <span>•</span>
                                        <span className={cn(
                                            "font-bold uppercase tracking-wider text-[9px]",
                                            task.urgency === "Urgent" ? "text-rose-500" :
                                                task.urgency === "High" ? "text-amber-500" :
                                                    "text-muted-foreground/40"
                                        )}>
                                            {task.urgency}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </Card>
    )
}
