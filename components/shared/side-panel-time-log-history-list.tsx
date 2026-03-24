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
        <div className={cn("space-y-2", className)}>
            {logs.length === 0 ? (
                <SidePanelEmptyState message={emptyMessage} className={cn("rounded-xl bg-white/70 text-sm", emptyClassName)} />
            ) : null}

            <div className={cn("space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2", listClassName)}>
                {logs.map((log) => {
                    const startDate = toDate(log.startTime)
                    const endDate = toDate(log.endTime)
                    const hasValidStart = Boolean(startDate)
                    const hasValidEnd = Boolean(endDate)
                    const rowClasses = "flex items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 transition hover:bg-slate-100 group w-full text-left"

                    const content = (
                        <div className={rowClasses}>
                            <div className="flex shrink-0 items-center justify-between w-24">
                                <span className="text-[11px] font-medium text-slate-500 truncate">
                                    {hasValidStart ? formatRelativeDate(startDate as Date) : "Unknown date"}
                                </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1 w-20 text-[11px] font-mono text-slate-400">
                                <span>{hasValidStart ? format(startDate as Date, "HH:mm") : "--:--"}</span>
                                <span className="opacity-50">-</span>
                                <span>{hasValidEnd ? format(endDate as Date, "HH:mm") : "..."}</span>
                            </div>

                            <div className="flex shrink-0 items-center w-14 justify-end">
                                <span className="text-[11px] font-bold tabular-nums text-slate-700">
                                    {formatDurationLabel(log.durationSeconds || 0)}
                                </span>
                            </div>

                            {log.taskName ? (
                                <SidePanelChip
                                    tone="emerald"
                                    label={log.taskName}
                                    className="rounded px-1.5 py-0.5 text-[10px] truncate max-w-[100px] shrink-0 ml-1"
                                />
                            ) : null}

                            {log.notes ? (
                                <span className="min-w-0 flex-1 truncate text-[11px] italic text-slate-400 group-hover:text-slate-500 transition-colors ml-1">
                                    {log.notes}
                                </span>
                            ) : null}
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
        </div>
    )
}
