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
                <SidePanelEmptyState message={emptyMessage} className={cn("rounded-xl bg-white/70 text-sm", emptyClassName)} />
            ) : (
                <>
                    {/* Table Header */}
                    <div className="flex items-center gap-2 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
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
                            const rowClasses = "flex items-center gap-2 px-2.5 py-1.5 transition hover:bg-slate-50 group w-full text-left border-b border-slate-50 last:border-0"

                            const content = (
                                <div className={rowClasses}>
                                    {/* Date Column */}
                                    <div className="w-24 shrink-0">
                                        <span className="text-[11px] font-medium text-slate-500 truncate block">
                                            {hasValidStart ? formatRelativeDate(startDate as Date) : "—"}
                                        </span>
                                    </div>

                                    {/* Time Column */}
                                    <div className="w-20 shrink-0 flex items-center gap-1 text-[11px] font-mono text-slate-400">
                                        <span>{hasValidStart ? format(startDate as Date, "HH:mm") : "--:--"}</span>
                                        <span className="opacity-30">-</span>
                                        <span>{hasValidEnd ? format(endDate as Date, "HH:mm") : "..."}</span>
                                    </div>

                                    {/* Duration Column */}
                                    <div className="w-14 shrink-0 flex justify-end">
                                        <span className="text-[11px] font-bold tabular-nums text-slate-700">
                                            {formatDurationLabel(log.durationSeconds || 0)}
                                        </span>
                                    </div>

                                    {/* Task Column */}
                                    <div className="w-28 shrink-0 ml-1 overflow-hidden">
                                        {log.taskName ? (
                                            <SidePanelChip
                                                tone="emerald"
                                                label={log.taskName}
                                                className="rounded px-1.5 py-0.5 text-[9px] font-bold truncate block w-full text-center"
                                            />
                                        ) : (
                                            <span className="text-[10px] text-slate-300 italic ml-2">—</span>
                                        )}
                                    </div>

                                    {/* Notes Column */}
                                    <div className="flex-1 ml-1 min-w-0">
                                        {log.notes ? (
                                            <span className="truncate text-[11px] text-slate-400 group-hover:text-slate-600 transition-colors block">
                                                {log.notes}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-200 block italic">—</span>
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
