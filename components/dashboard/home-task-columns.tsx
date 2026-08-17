"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LmsIcon } from "@/components/lms/lms-icon"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import {
    completeHomeOpenTaskState,
    createHomeOpenTaskState,
    formatHomeOpenTaskResultLabel,
    type HomeOpenTaskPayload,
} from "@/lib/homepage"

export type HomeOpenTask = HomeOpenTaskPayload

interface HomeTaskColumnsProps {
    tasks: HomeOpenTask[]
    totalOpenTasks: number
}

function getTaskContext(task: HomeOpenTask) {
    if (task.taskScope === "LMS") {
        return task.lmsAllocation?.client || "LMS"
    }

    return task.project?.site?.domainName || task.project?.name || "General"
}

export function HomeTaskColumns({ tasks, totalOpenTasks }: HomeTaskColumnsProps) {
    const { requestCompletion, pendingTaskId } = useTaskCompletion()
    const [taskState, setTaskState] = React.useState(() =>
        createHomeOpenTaskState(tasks, totalOpenTasks)
    )

    React.useEffect(() => {
        setTaskState(createHomeOpenTaskState(tasks, totalOpenTasks))
    }, [tasks, totalOpenTasks])

    const handleComplete = React.useCallback((task: HomeOpenTask) => {
        requestCompletion(task, {
            onCompleted: () => {
                setTaskState((current) => completeHomeOpenTaskState(current, task.id))
            },
        })
    }, [requestCompletion])

    const resultLabel = formatHomeOpenTaskResultLabel(
        taskState.tasks.length,
        taskState.totalOpenTasks
    )

    return (
        <section className="overflow-hidden rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--line-subtle)] px-4 py-4 sm:px-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
                        <h2 className="ui-text-section text-[var(--text-primary)]">Open tasks</h2>
                    </div>
                    <p className="ui-text-caption mt-1.5 text-[var(--text-muted)]">{resultLabel}</p>
                </div>

                <Button asChild variant="ghost" size="sm" className="shrink-0">
                    <Link href="/tasks?status=Active">
                        View all
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            </div>

            {taskState.tasks.length > 0 ? (
                <div className="divide-y divide-[var(--line-subtle)]">
                    {taskState.tasks.map((task) => {
                        const isCompleting = pendingTaskId === task.id
                        return (
                            <article
                                key={task.id}
                                data-home-open-task-id={task.id}
                                className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--surface-low)] sm:px-4"
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleComplete(task)}
                                    disabled={Boolean(pendingTaskId)}
                                    aria-label={`Mark ${task.name || "task"} complete`}
                                    title="Mark complete"
                                    className="h-11 w-11 rounded-full text-[var(--text-muted)] hover:bg-[var(--state-success-surface)] hover:text-[var(--state-success)]"
                                >
                                    {isCompleting
                                        ? <Loader2 className="h-5 w-5 animate-spin" />
                                        : <Circle className="h-5 w-5" />}
                                </Button>

                                <div className="min-w-0 px-1 py-2">
                                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                        {task.name || "Untitled task"}
                                    </p>
                                    <p className="ui-text-caption mt-1 flex min-w-0 items-center gap-1.5 text-[var(--text-muted)]">
                                        {task.taskScope === "LMS" ? <LmsIcon className="h-4 w-4" /> : null}
                                        <span className="truncate">{getTaskContext(task)}</span>
                                    </p>
                                </div>
                            </article>
                        )
                    })}
                </div>
            ) : (
                <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-[var(--state-success)]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">No open tasks.</p>
                    <p className="ui-text-caption max-w-sm text-[var(--text-muted)]">
                        New tasks will appear here until you mark them complete.
                    </p>
                </div>
            )}

        </section>
    )
}
