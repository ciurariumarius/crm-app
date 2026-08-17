"use client"

import * as React from "react"
import { Clock3, Loader2, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateTask } from "@/lib/actions/tasks"
import {
    MAX_TASK_ESTIMATED_MINUTES,
    formatTaskEstimatedMinutes,
    parseTaskEstimatedMinutesInput,
} from "@/lib/tasks/estimated-time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const QUICK_ESTIMATES = [15, 30, 60, 120] as const

type TaskEstimatedTimeQuickEditProps = {
    taskId: string
    taskName?: string | null
    estimatedMinutes?: number | null
    onSaved?: (estimatedMinutes: number | null) => void
}

export function TaskEstimatedTimeQuickEdit({
    taskId,
    taskName,
    estimatedMinutes,
    onSaved,
}: TaskEstimatedTimeQuickEditProps) {
    const router = useRouter()
    const [open, setOpen] = React.useState(false)
    const [savedMinutes, setSavedMinutes] = React.useState<number | null>(
        estimatedMinutes ?? null
    )
    const [draft, setDraft] = React.useState(
        estimatedMinutes == null ? "" : String(estimatedMinutes)
    )
    const [attempted, setAttempted] = React.useState(false)
    const [saving, setSaving] = React.useState(false)

    React.useEffect(() => {
        setSavedMinutes(estimatedMinutes ?? null)
        setDraft(estimatedMinutes == null ? "" : String(estimatedMinutes))
    }, [estimatedMinutes])

    const parsedDraft = parseTaskEstimatedMinutesInput(draft)
    const invalid = parsedDraft === undefined
    const formatted = formatTaskEstimatedMinutes(savedMinutes)
    const hasChanged = parsedDraft !== undefined && parsedDraft !== savedMinutes

    const changeOpen = React.useCallback((nextOpen: boolean) => {
        if (saving) return
        setOpen(nextOpen)
        setAttempted(false)
        if (nextOpen) setDraft(savedMinutes == null ? "" : String(savedMinutes))
    }, [savedMinutes, saving])

    const save = React.useCallback(async () => {
        setAttempted(true)
        const nextMinutes = parseTaskEstimatedMinutesInput(draft)
        if (nextMinutes === undefined) return
        if (nextMinutes === savedMinutes) {
            setOpen(false)
            return
        }

        setSaving(true)
        try {
            const result = await updateTask(taskId, { estimatedMinutes: nextMinutes })
            if (!result.success) {
                toast.error(result.error || "Failed to update planned time")
                return
            }

            setSavedMinutes(nextMinutes)
            onSaved?.(nextMinutes)
            setOpen(false)
            toast.success(nextMinutes == null ? "Planned time removed" : "Planned time updated")
            router.refresh()
        } catch {
            toast.error("Failed to update planned time")
        } finally {
            setSaving(false)
        }
    }, [draft, onSaved, router, savedMinutes, taskId])

    return (
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                        "group/time inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                        formatted
                            ? "border-[color:color-mix(in_srgb,var(--brand-primary)_24%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,var(--surface-lowest))] text-[var(--brand-primary)] hover:border-[color:color-mix(in_srgb,var(--brand-primary)_45%,var(--line-subtle))]"
                            : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                    aria-label={`${formatted ? `Edit estimated time ${formatted}` : "Add estimated time"} for ${taskName || "task"}`}
                    title="Edit planned time"
                >
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatted ? `Est. ${formatted}` : "Add time"}</span>
                    <Pencil className="h-3 w-3 shrink-0 opacity-45 transition-opacity group-hover/time:opacity-100" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[min(320px,calc(100vw-2rem))] rounded-[18px] p-4"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <PopoverHeader>
                    <PopoverTitle className="text-sm font-bold text-[var(--text-primary)]">
                        Planned time
                    </PopoverTitle>
                    <PopoverDescription className="text-xs leading-5 text-[var(--text-muted)]">
                        Set the planned time for this task.
                    </PopoverDescription>
                </PopoverHeader>

                <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor={`task-estimate-${taskId}`} className="text-xs font-semibold text-[var(--text-secondary)]">
                            Minutes
                        </Label>
                        <Input
                            id={`task-estimate-${taskId}`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={draft}
                            onChange={(event) => {
                                setDraft(event.target.value)
                                setAttempted(false)
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault()
                                    void save()
                                }
                                if (event.key === "Escape") changeOpen(false)
                            }}
                            placeholder="e.g. 90"
                            autoFocus
                            disabled={saving}
                            aria-invalid={attempted && invalid}
                            className={cn(
                                "h-11 rounded-xl bg-[var(--surface-lowest)] font-semibold tabular-nums",
                                attempted && invalid && "border-[var(--state-urgent)]"
                            )}
                        />
                        {attempted && invalid ? (
                            <p className="text-xs font-medium text-[var(--state-urgent)]">
                                Enter 1–{MAX_TASK_ESTIMATED_MINUTES.toLocaleString()} minutes, or leave empty to remove it.
                            </p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5" aria-label="Quick planned time options">
                        {QUICK_ESTIMATES.map((minutes) => (
                            <button
                                key={minutes}
                                type="button"
                                onClick={() => {
                                    setDraft(String(minutes))
                                    setAttempted(false)
                                }}
                                disabled={saving}
                                className={cn(
                                    "h-9 rounded-lg border text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                                    draft === String(minutes)
                                        ? "border-[var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,var(--surface-lowest))] text-[var(--brand-primary)]"
                                        : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                )}
                            >
                                {formatTaskEstimatedMinutes(minutes)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] pt-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDraft("")}
                        disabled={saving || savedMinutes == null}
                        className="text-[var(--text-muted)]"
                    >
                        Remove
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => changeOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={() => void save()} disabled={saving || invalid || !hasChanged}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
