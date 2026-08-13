"use client"

import { format } from "date-fns"
import { SidePanelChip, SidePanelEmptyState } from "@/components/ui/side-panel-primitives"
import { formatRelativeDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

export type SidePanelTimeLogItem = {
    id?: string
    startTime?: Date | string | null
    endTime?: Date | string | null
    durationSeconds?: number | null
    notes?: string | null
    taskName?: string | null
}

type SidePanelTimeLogHistoryListProps = {
    logs: SidePanelTimeLogItem[]
    emptyMessage: string
    onSelectLog?: (log: SidePanelTimeLogItem) => void
    className?: string
    listClassName?: string
    emptyClassName?: string
}

function toDate(value: Date | string | null | undefined) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDurationLabel(totalSeconds: number) {
    if (!totalSeconds) return "0s"
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
}

export function SidePanelTimeLogHistoryList({
    logs,
    emptyMessage,
    onSelectLog,
    className,
    listClassName,
    emptyClassName,
}: SidePanelTimeLogHistoryListProps) {
    return (
        <div className={cn("space-y-0", className)}>
            {logs.length === 0 ? (
                <SidePanelEmptyState message={emptyMessage} className={cn("rounded-xl bg-[color:color-mix(in_srgb,var(--surface-lowest)_88%,transparent)] text-sm", emptyClassName)} />
            ) : (
                <>
                    {/* Table Header */}
                    <div className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-2.5 py-2 text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                        <div className="w-24 shrink-0">Date</div>
                        <div className="w-20 shrink-0">Time</div>
                        <div className="w-14 shrink-0 text-right">Duration</div>
                        <div className="w-28 shrink-0 ml-1">Task</div>
                        <div className="flex-1 ml-1">Notes</div>
                    </div>

                    <div className={cn("max-h-[400px] overflow-y-auto custom-scrollbar", listClassName)}>
                        {logs.map((log) => {
                            const startDate = toDate(log.startTime)
                            const endDate = toDate(log.endTime)
                            const hasValidStart = Boolean(startDate)
                            const hasValidEnd = Boolean(endDate)
                            
                            // Row styling: simple border-b, no card-like padding/background unless hovered
                            const rowClasses = "group flex w-full items-center gap-2 border-b border-[color:color-mix(in_srgb,var(--line-subtle)_75%,transparent)] px-2.5 py-1.5 text-left transition hover:bg-[var(--surface-low)] last:border-0"

                            const content = (
                                <div className={rowClasses}>
                                    {/* Date Column */}
                                    <div className="w-24 shrink-0">
                                        <span className="block truncate text-xs font-medium text-[var(--text-secondary)]">
                                            {hasValidStart ? formatRelativeDate(startDate as Date) : "—"}
                                        </span>
                                    </div>

                                    {/* Time Column */}
                                    <div className="flex w-20 shrink-0 items-center gap-1 text-xs font-mono text-[var(--text-muted)]">
                                        <span>{hasValidStart ? format(startDate as Date, "HH:mm") : "--:--"}</span>
                                        <span className="opacity-30">-</span>
                                        <span>{hasValidEnd ? format(endDate as Date, "HH:mm") : "..."}</span>
                                    </div>

                                    {/* Duration Column */}
                                    <div className="w-14 shrink-0 flex justify-end">
                                        <span className="text-xs font-bold tabular-nums text-[var(--text-primary)]">
                                            {formatDurationLabel(log.durationSeconds || 0)}
                                        </span>
                                    </div>

                                    {/* Task Column */}
                                    <div className="w-28 shrink-0 ml-1 overflow-hidden">
                                        {log.taskName ? (
                                            <SidePanelChip
                                                tone="emerald"
                                                label={log.taskName}
                                                className="rounded px-1.5 py-0.5 text-xs font-bold truncate block w-full text-center"
                                            />
                                        ) : (
                                            <span className="ml-2 text-xs italic text-[var(--text-muted)]">—</span>
                                        )}
                                    </div>

                                    {/* Notes Column */}
                                    <div className="flex-1 ml-1 min-w-0">
                                        {log.notes ? (
                                            <span className="block truncate text-xs text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-secondary)]">
                                                {log.notes}
                                            </span>
                                        ) : (
                                            <span className="block text-xs italic text-[var(--text-muted)]">—</span>
                                        )}
                                    </div>
                                </div>
                            )

                            if (!onSelectLog) {
                                return <div key={log.id || `${log.startTime || "start"}-${log.endTime || "end"}`}>{content}</div>
                            }

                            return (
                                <button
                                    type="button"
                                    key={log.id || `${log.startTime || "start"}-${log.endTime || "end"}`}
                                    onClick={() => onSelectLog(log)}
                                    className="block w-full"
                                >
                                    {content}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
