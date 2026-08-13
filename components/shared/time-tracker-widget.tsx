"use client"

import * as React from "react"
import { Play, Pause, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function formatClock(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export interface TimeTrackerWidgetProps {
    totalTrackedHours: number
    totalTrackedMinutes: number
    currentSessionSeconds: number
    isRunning: boolean
    isPaused: boolean
    timerStatusLabel: string
    onPrimaryAction: () => void
    onStopAction: () => void
    isStopDisabled?: boolean
}

export function TimeTrackerWidget({
    totalTrackedHours,
    totalTrackedMinutes,
    currentSessionSeconds,
    isRunning,
    isPaused,
    timerStatusLabel,
    onPrimaryAction,
    onStopAction,
    isStopDisabled
}: TimeTrackerWidgetProps) {
    const primaryActionLabel = isRunning ? "Pause" : isPaused ? "Resume" : "Start"

    return (
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-4 py-3 shadow-[var(--shadow-apple)]">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-5 overflow-hidden">
                    {/* Total Tracked */}
                    <div className="flex items-baseline gap-2 shrink-0">
                        <span className="hidden text-xs font-semibold text-[var(--text-secondary)] sm:inline">Total tracked:</span>
                        <span className="font-mono text-[15px] font-black tabular-nums text-[var(--text-primary)]">
                            {totalTrackedHours}h {totalTrackedMinutes}m
                        </span>
                    </div>

                    <div className="h-4 w-px shrink-0 bg-[var(--line-subtle)]" />

                    {/* Current Session */}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="hidden text-xs font-semibold text-[var(--text-secondary)] sm:inline">Session:</span>
                        <span className={cn(
                            "font-mono text-[15px] font-bold tabular-nums truncate",
                            isRunning ? "text-emerald-600" : "text-[var(--text-primary)]"
                        )}>
                            {formatClock(currentSessionSeconds)}
                        </span>
                        <span className={cn(
                            "text-xs font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 shrink-0",
                            isRunning ? "bg-emerald-100/50 text-emerald-600" : isPaused ? "bg-amber-100/50 text-amber-600" : "hidden"
                        )}>
                            {timerStatusLabel}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <Button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPrimaryAction(); }}
                        className={cn(
                            "h-9 rounded-full px-4 text-[13px] font-bold shadow-sm transition-all active:scale-[0.98]",
                            isRunning
                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                : "bg-[var(--brand-cyan)] text-white hover:bg-[color:color-mix(in_srgb,var(--brand-cyan)_88%,black)]"
                        )}
                    >
                        {isRunning ? (
                            <Pause className="mr-1.5 h-3.5 w-3.5 fill-current" />
                        ) : (
                            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                        )}
                        {primaryActionLabel}
                    </Button>

                    <Button
                        type="button"
                        size="icon"
                        disabled={isStopDisabled}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStopAction(); }}
                        className="h-9 w-9 shrink-0 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-50"
                    >
                        <Square className="h-3.5 w-3.5 fill-current" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
