"use client"

import * as React from "react"
import { History, Receipt } from "lucide-react"
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
    return (
        <>
            <section className="space-y-0 border-t border-slate-200/80 pt-3">
                <SidePanelSectionTitle title="Payment history" icon={<Receipt className="h-3.5 w-3.5" />} />
                
                {isLoadingHistory && paymentHistory.length === 0 ? (
                    <SidePanelLoadingState message="Loading payment history..." />
                ) : paymentHistory.length === 0 ? (
                    <div className="pt-2">
                        <SidePanelEmptyState message="No payment records found." />
                    </div>
                ) : (
                    <div className="mt-2">
                        {/* Table Header */}
                        <div className="flex items-center gap-2 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                            <div className="w-24 shrink-0">Date</div>
                            <div className="flex-1">Action</div>
                            <div className="w-16 shrink-0 text-right">Status</div>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {paymentHistory.map((entry) => (
                                <div key={entry.id} className="flex items-center gap-2 px-2.5 py-2 transition hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                    <div className="w-24 shrink-0">
                                        <span className="text-[11px] font-medium text-slate-500 truncate block">
                                            {formatRelativeDate(entry.date)}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[11px] font-bold text-slate-700 block">
                                            Marked as {entry.status}
                                        </span>
                                    </div>
                                    <div className="w-16 shrink-0 flex justify-end">
                                        <SidePanelChip tone={sidePanelChipToneByLabel(entry.status)} label={entry.status} className="text-[9px] font-bold px-1.5 py-0.5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-0 border-t border-slate-200/80 pt-3 mt-4">
                <SidePanelSectionTitle title="Project history" icon={<History className="h-3.5 w-3.5" />} />
                
                {isLoadingStatusHistory && statusHistoryEntries.length === 0 ? (
                    <SidePanelLoadingState message="Loading status history..." />
                ) : statusHistoryEntries.length === 0 ? (
                    <div className="pt-2">
                        <SidePanelEmptyState message="No status records found." />
                    </div>
                ) : (
                    <div className="mt-2">
                        {/* Table Header */}
                        <div className="flex items-center gap-2 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                            <div className="w-24 shrink-0">Date</div>
                            <div className="flex-1">Transition</div>
                            <div className="w-16 shrink-0 text-right">Result</div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {statusHistoryEntries.map((entry) => (
                                <div key={entry.id} className="flex items-center gap-2 px-2.5 py-2 transition hover:bg-slate-50 border-b border-slate-50 last:border-0 group">
                                    <div className="w-24 shrink-0">
                                        <span className="text-[11px] font-medium text-slate-500 truncate block">
                                            {formatRelativeDate(entry.date)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-bold text-slate-700 truncate block">
                                            {entry.action === "PROJECT_CREATED"
                                                ? "Project created"
                                                : entry.fromStatus
                                                    ? `${entry.fromStatus} -> ${entry.toStatus}`
                                                    : `Marked as ${entry.toStatus}`}
                                        </span>
                                        {entry.source && (
                                            <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors block truncate">
                                                {entry.source.replaceAll("_", " ")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-16 shrink-0 flex justify-end">
                                        <SidePanelChip tone={sidePanelChipToneByLabel(entry.toStatus)} label={entry.toStatus} className="text-[9px] font-bold px-1.5 py-0.5" />
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
