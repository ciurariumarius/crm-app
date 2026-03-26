"use client"

import * as React from "react"
import { format } from "date-fns"
import { History } from "lucide-react"
import { formatRelativeDate } from "@/lib/utils"
import { SidePanelChip, SidePanelEmptyState, SidePanelLoadingState, SidePanelSectionTitle, sidePanelChipToneByLabel } from "@/components/ui/side-panel-primitives"

export type TaskHistoryEntry = {
    id: string
    action: string
    date: Date | string
    from?: string | null
    to?: string | null
    source?: string | null
}

function decodeAuditDateToken(value: string | null | undefined) {
    if (!value || value === "none" || value === "invalid") return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

type TaskHistorySectionProps = {
    entries: TaskHistoryEntry[]
    isLoading: boolean
}

export function TaskHistorySection({ entries, isLoading }: TaskHistorySectionProps) {
    return (
        <section className="space-y-0 border-t border-slate-200/80 pt-3">
            <SidePanelSectionTitle title="Task history" icon={<History className="h-3.5 w-3.5" />} />
            
            {isLoading && entries.length === 0 ? (
                <SidePanelLoadingState message="Loading task history..." />
            ) : entries.length === 0 ? (
                <div className="pt-2">
                    <SidePanelEmptyState message="No task history records found." />
                </div>
            ) : (
                <div className="mt-2">
                    {/* Table Header */}
                    <div className="flex items-center gap-2 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <div className="w-24 shrink-0">Date</div>
                        <div className="flex-1">Event</div>
                        <div className="w-16 shrink-0 text-right">Type</div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {entries.map((entry) => {
                            const sourceLabel = entry.source ? entry.source.replaceAll("_", " ") : null
                            const fromDate = decodeAuditDateToken(entry.from)
                            const toDateValue = decodeAuditDateToken(entry.to)

                            let entryTitle = "Task updated"
                            let entryBadge = "Update"

                            if (entry.action === "TASK_CREATED") {
                                entryTitle = "Task created"
                                entryBadge = "Created"
                            } else if (entry.action === "TASK_STATUS_CHANGED") {
                                entryTitle = `${entry.from || "—"} → ${entry.to || "—"}`
                                entryBadge = "Status"
                            } else if (entry.action === "TASK_PRIORITY_CHANGED") {
                                entryTitle = `Priority: ${entry.from || "—"} → ${entry.to || "—"}`
                                entryBadge = "Priority"
                            } else if (entry.action === "TASK_DEADLINE_CHANGED") {
                                if (!fromDate && toDateValue) {
                                    entryTitle = `Deadline set: ${format(toDateValue, "dd MMM yyyy")}`
                                } else if (fromDate && !toDateValue) {
                                    entryTitle = "Deadline removed"
                                } else if (fromDate && toDateValue) {
                                    entryTitle = `Deadline: ${format(fromDate, "dd MMM yyyy")} → ${format(toDateValue, "dd MMM yyyy")}`
                                } else {
                                    entryTitle = "Deadline updated"
                                }
                                entryBadge = "Deadline"
                            }

                            return (
                                <div key={entry.id} className="flex items-center gap-2 px-2.5 py-2 transition hover:bg-slate-50 border-b border-slate-50 last:border-0 group">
                                    <div className="w-24 shrink-0">
                                        <span className="text-[11px] font-medium text-slate-500 truncate block">
                                            {formatRelativeDate(entry.date)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-bold text-slate-700 truncate block">
                                            {entryTitle}
                                        </span>
                                        {sourceLabel && (
                                            <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors block truncate">
                                                {sourceLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-16 shrink-0 flex justify-end">
                                        <SidePanelChip tone={sidePanelChipToneByLabel(entryBadge)} label={entryBadge} className="text-[9px] font-bold px-1.5 py-0.5" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </section>
    )
}

