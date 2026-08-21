"use client"

import * as React from "react"
import { Clock3, Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setTaskTimeTotal } from "@/lib/actions/time"
import {
    formatTaskTrackedSeconds,
    MAX_TASK_TRACKED_MINUTES,
    parseTaskTrackedMinutesInput,
} from "@/lib/tasks/tracked-time"
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

const QUICK_TOTALS = [30, 60, 120, 240] as const

type TaskActualTimeQuickEditProps = {
    taskId: string
    taskName?: string | null
    totalSeconds: number
    onSaved?: (totalSeconds: number) => void
    disabled?: boolean
}

export function TaskActualTimeQuickEdit({
    taskId,
    taskName,
    totalSeconds,
    onSaved,
    disabled = false,
}: TaskActualTimeQuickEditProps) {
    const router = useRouter()
    const initialMinutes = Math.max(0, Math.round(totalSeconds / 60))
    const [open, setOpen] = React.useState(false)
    const [savedMinutes, setSavedMinutes] = React.useState(initialMinutes)
    const [draft, setDraft] = React.useState(String(initialMinutes))
    const [attempted, setAttempted] = React.useState(false)
    const [saving, setSaving] = React.useState(false)

    React.useEffect(() => {
        const nextMinutes = Math.max(0, Math.round(totalSeconds / 60))
        setSavedMinutes(nextMinutes)
        setDraft(String(nextMinutes))
    }, [totalSeconds])

    const parsedDraft = parseTaskTrackedMinutesInput(draft)
    const invalid = parsedDraft === undefined
    const hasChanged = parsedDraft !== undefined && parsedDraft !== savedMinutes

    const changeOpen = React.useCallback((nextOpen: boolean) => {
        if (saving || disabled) return
        setOpen(nextOpen)
        setAttempted(false)
        if (nextOpen) setDraft(String(savedMinutes))
    }, [disabled, savedMinutes, saving])

    const save = React.useCallback(async () => {
        setAttempted(true)
        const nextMinutes = parseTaskTrackedMinutesInput(draft)
        if (nextMinutes === undefined) return
        if (nextMinutes === savedMinutes) {
            setOpen(false)
            return
        }

        setSaving(true)
        try {
            const result = await setTaskTimeTotal({ taskId, totalMinutes: nextMinutes })
            if (!result.success) {
                toast.error(result.error || "Failed to update total time")
                return
            }
            setSavedMinutes(nextMinutes)
            onSaved?.(nextMinutes * 60)
            setOpen(false)
            toast.success("Total time updated")
            router.refresh()
        } catch {
            toast.error("Failed to update total time")
        } finally {
            setSaving(false)
        }
    }, [draft, onSaved, router, savedMinutes, taskId])

    return (
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                        "group/time inline-flex h-7 min-w-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
                        savedMinutes > 0
                            ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 font-bold"
                            : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-zinc-300"
                    )}
                    aria-label={`Edit total time for ${taskName || "task"}`}
                    title="Edit total time"
                >
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-current" />
                    <span className="truncate">{formatTaskTrackedSeconds(savedMinutes * 60)}</span>
                    {savedMinutes === 0 ? (
                        <div className="ml-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-[color:color-mix(in_srgb,var(--text-muted)_15%,transparent)] transition-colors group-hover/time:bg-[color:color-mix(in_srgb,var(--text-muted)_25%,transparent)]">
                            <Plus className="h-3 w-3 text-[var(--text-primary)]" strokeWidth={2.5} />
                        </div>
                    ) : null}
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[min(330px,calc(100vw-2rem))] rounded-[18px] p-4"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <PopoverHeader>
                    <PopoverTitle className="text-sm font-bold text-[var(--text-primary)]">Edit total time</PopoverTitle>
                    <PopoverDescription className="text-xs leading-5 text-[var(--text-muted)]">
                        The newest sessions are adjusted so their sum matches this total.
                    </PopoverDescription>
                </PopoverHeader>

                <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor={`task-total-time-${taskId}`} className="text-xs font-semibold text-[var(--text-secondary)]">
                            Total minutes
                        </Label>
                        <Input
                            id={`task-total-time-${taskId}`}
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
                                Enter 0–{MAX_TASK_TRACKED_MINUTES.toLocaleString()} whole minutes.
                            </p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5" aria-label="Quick total-time options">
                        {QUICK_TOTALS.map((minutes) => (
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
                                {formatTaskTrackedSeconds(minutes * 60)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2 border-t border-[var(--line-subtle)] pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => changeOpen(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={() => void save()} disabled={saving || invalid || !hasChanged}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Save total
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
