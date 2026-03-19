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
        <section className="space-y-2 border-t border-slate-200/80 pt-3">
            <SidePanelSectionTitle title="Task history (log)" icon={<History className="h-3.5 w-3.5" />} />
            <div className="space-y-1.5">
                {isLoading && entries.length === 0 ? (
                    <SidePanelLoadingState message="Loading task history..." />
                ) : entries.length === 0 ? (
                    <SidePanelEmptyState message="No task history records found." />
                ) : (
                    entries.map((entry) => {
                        const sourceLabel = entry.source ? entry.source.replaceAll("_", " ") : null
                        const fromDate = decodeAuditDateToken(entry.from)
                        const toDateValue = decodeAuditDateToken(entry.to)

                        let entryTitle = "Task updated"
                        let entryBadge = "Update"

                        if (entry.action === "TASK_CREATED") {
                            entryTitle = "Task created"
                            entryBadge = "Created"
                        } else if (entry.action === "TASK_STATUS_CHANGED") {
                            entryTitle = `${entry.from || "Unknown"} -> ${entry.to || "Unknown"}`
                            entryBadge = "Status"
                        } else if (entry.action === "TASK_PRIORITY_CHANGED") {
                            entryTitle = `Priority: ${entry.from || "Unknown"} -> ${entry.to || "Unknown"}`
                            entryBadge = "Priority"
                        } else if (entry.action === "TASK_DEADLINE_CHANGED") {
                            if (!fromDate && toDateValue) {
                                entryTitle = `Deadline set: ${format(toDateValue, "dd MMM yyyy")}`
                            } else if (fromDate && !toDateValue) {
                                entryTitle = "Deadline removed"
                            } else if (fromDate && toDateValue) {
                                entryTitle = `Deadline: ${format(fromDate, "dd MMM yyyy")} -> ${format(toDateValue, "dd MMM yyyy")}`
                            } else {
                                entryTitle = "Deadline updated"
                            }
                            entryBadge = "Deadline"
                        }

                        return (
                            <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                        <History className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">{entryTitle}</span>
                                        <span className="ui-text-caption text-slate-400">
                                            {formatRelativeDate(entry.date)}
                                            {sourceLabel ? ` • ${sourceLabel}` : ""}
                                        </span>
                                    </div>
                                </div>
                                <SidePanelChip tone={sidePanelChipToneByLabel(entryBadge)} label={entryBadge} className="px-2 py-1 text-[10px]" />
                            </div>
                        )
                    })
                )}
            </div>
        </section>
    )
}

