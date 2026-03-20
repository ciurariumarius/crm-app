"use client"

import * as React from "react"
import { CheckCircle, Clock3, History } from "lucide-react"
import { cn, formatRelativeDate } from "@/lib/utils"
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
    return (
        <>
            <section className="space-y-2 border-t border-slate-200/80 pt-3">
                <SidePanelSectionTitle title="Payment history (log)" icon={<History className="h-3.5 w-3.5" />} />
                <div className="space-y-1.5">
                    {isLoadingHistory && paymentHistory.length === 0 ? (
                        <SidePanelLoadingState message="Loading payment history..." />
                    ) : paymentHistory.length === 0 ? (
                        <SidePanelEmptyState message="No payment records found." />
                    ) : (
                        paymentHistory.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={cn(
                                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                            entry.status === "Paid" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                        )}
                                    >
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">Marked as {entry.status}</span>
                                        <span className="ui-text-caption text-slate-400">{formatRelativeDate(entry.date)}</span>
                                    </div>
                                </div>
                                <SidePanelChip tone={sidePanelChipToneByLabel(entry.status)} label={entry.status} className="text-[10px]" />
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="space-y-2 border-t border-slate-200/80 pt-3">
                <SidePanelSectionTitle title="Status history (log)" icon={<Clock3 className="h-3.5 w-3.5" />} />
                <div className="space-y-1.5">
                    {isLoadingStatusHistory && statusHistoryEntries.length === 0 ? (
                        <SidePanelLoadingState message="Loading status history..." />
                    ) : statusHistoryEntries.length === 0 ? (
                        <SidePanelEmptyState message="No status records found." />
                    ) : (
                        statusHistoryEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={cn(
                                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                            entry.toStatus === "Active" && "bg-blue-50 text-blue-600",
                                            entry.toStatus === "Paused" && "bg-amber-50 text-amber-600",
                                            entry.toStatus === "Completed" && "bg-emerald-50 text-emerald-600",
                                            entry.toStatus === "Closed" && "bg-slate-100 text-slate-600",
                                            !["Active", "Paused", "Completed", "Closed"].includes(entry.toStatus) && "bg-slate-100 text-slate-600"
                                        )}
                                    >
                                        <Clock3 className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">
                                            {entry.action === "PROJECT_CREATED"
                                                ? "Project created"
                                                : entry.fromStatus
                                                    ? `${entry.fromStatus} -> ${entry.toStatus}`
                                                    : `Marked as ${entry.toStatus}`}
                                        </span>
                                        <span className="ui-text-caption text-slate-400">
                                            {formatRelativeDate(entry.date)}
                                            {entry.source ? ` • ${entry.source.replaceAll("_", " ")}` : ""}
                                        </span>
                                    </div>
                                </div>
                                <SidePanelChip tone={sidePanelChipToneByLabel(entry.toStatus)} label={entry.toStatus} className="text-[10px]" />
                            </div>
                        ))
                    )}
                </div>
            </section>
        </>
    )
}
