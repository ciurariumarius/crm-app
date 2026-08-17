"use client"

import * as React from "react"
import { History } from "lucide-react"
import { formatRelativeDate } from "@/lib/utils"
import { SidePanelChip, SidePanelEmptyState, SidePanelLoadingState, SidePanelSectionTitle, sidePanelChipToneByLabel } from "@/components/ui/side-panel-primitives"

export type ProjectPaymentHistoryEntry = {
    id: string
    action: string
    date: Date | string
    status: string
}

export type ProjectStatusHistoryEntry = {
    id: string
    action: string
    date: Date | string
    fromStatus: string | null
    toStatus: string
    source: string | null
}

type ProjectHistoryLogSectionsProps = {
    paymentHistory: ProjectPaymentHistoryEntry[]
    isLoadingHistory: boolean
    statusHistoryEntries: ProjectStatusHistoryEntry[]
    isLoadingStatusHistory: boolean
}

export function ProjectHistoryLogSections({
    paymentHistory,
    isLoadingHistory,
    statusHistoryEntries,
    isLoadingStatusHistory,
}: ProjectHistoryLogSectionsProps) {
    const activityEntries = React.useMemo(() => [
        ...paymentHistory.map((entry) => ({
            id: `payment-${entry.id}`,
            date: entry.date,
            title: `Marked as ${entry.status}`,
            detail: "Payment",
            result: entry.status,
        })),
        ...statusHistoryEntries.map((entry) => ({
            id: `status-${entry.id}`,
            date: entry.date,
            title: entry.action === "PROJECT_CREATED"
                ? "Project created"
                : entry.fromStatus
                    ? `${entry.fromStatus} → ${entry.toStatus}`
                    : `Marked as ${entry.toStatus}`,
            detail: entry.source ? entry.source.replaceAll("_", " ") : "Project",
            result: entry.toStatus,
        })),
    ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()), [paymentHistory, statusHistoryEntries])

    return (
        <>
            <section className="space-y-0 border-t border-[var(--line-subtle)] pt-3">
                <SidePanelSectionTitle title="Activity" icon={<History className="h-3.5 w-3.5" />} />
                
                {(isLoadingHistory || isLoadingStatusHistory) && activityEntries.length === 0 ? (
                    <SidePanelLoadingState message="Loading project activity..." />
                ) : activityEntries.length === 0 ? (
                    <div className="pt-2">
                        <SidePanelEmptyState message="No project activity found." />
                    </div>
                ) : (
                    <div className="mt-2">
                        {/* Table Header */}
                        <div className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-2.5 py-2 text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                            <div className="w-24 shrink-0">Date</div>
                            <div className="flex-1">Event</div>
                            <div className="w-20 shrink-0 text-right">Result</div>
                        </div>
                        
                        <div className="divide-y divide-[var(--line-subtle)]">
                            {activityEntries.map((entry) => (
                                <div key={entry.id} className="flex min-h-14 items-center gap-2 px-2.5 py-2 transition hover:bg-[var(--surface-low)]">
                                    <div className="w-24 shrink-0">
                                        <span className="block truncate text-xs font-medium text-[var(--text-secondary)]">
                                            {formatRelativeDate(entry.date)}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-xs font-bold text-[var(--text-primary)]">
                                            {entry.title}
                                        </span>
                                        <span className="block truncate text-xs text-[var(--text-muted)]">{entry.detail}</span>
                                    </div>
                                    <div className="flex w-20 shrink-0 justify-end">
                                        <SidePanelChip tone={sidePanelChipToneByLabel(entry.result)} label={entry.result} className="px-1.5 py-0.5 text-xs font-bold" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </>
    )
}
