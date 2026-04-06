"use client"

import { useState, Fragment } from "react"
import { cn, formatCurrency, formatProjectName, formatRelativeDate } from "@/lib/utils"
import { CreditCard, History, Undo2, ChevronRight } from "lucide-react"
import { StatusChip } from "@/components/ui/status-chip"
import { ListEmptyState } from "@/components/ui/list-state"

type SettlementProjectEntry = {
    id: string
    name: string
    fee: number
}

type ParsedPaymentDetails = {
    projectName: string
    extraProjects: SettlementProjectEntry[]
    totalAmount: number
}

type PaymentLogEntry = {
    id: string
    action: string
    status: string
    details: string | null
    date: Date | string
}

type PaymentProjectSummary = {
    id: string
    name?: string | null
    createdAt?: string | Date | null
    currentFee?: number | string | null | { toNumber: () => number }
    site?: {
        domainName?: string | null
    } | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
}

interface PaymentsTableProps {
    logs: PaymentLogEntry[]
    projects: PaymentProjectSummary[]
}

function toProjectFee(value: PaymentProjectSummary["currentFee"]) {
    if (value == null) return 0
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
        return value.toNumber()
    }
    return 0
}

export function PaymentsTable({ logs, projects }: PaymentsTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    const toggleRow = (id: string, isExpandable: boolean) => {
        if (!isExpandable) return
        const next = new Set(expandedRows)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setExpandedRows(next)
    }

    const parseDetails = (details: string | null): ParsedPaymentDetails => {
        if (!details) return { projectName: "Unknown Project", extraProjects: [], totalAmount: 0 }

        try {
            const data = JSON.parse(details)
            if (data.projects && Array.isArray(data.projects)) {
                if (data.projects.length === 1) {
                    return {
                        projectName: data.projects[0].name || "Project",
                        extraProjects: [],
                        totalAmount: data.totalAmount || data.projects[0].fee || 0
                    }
                }
                return {
                    projectName: `${data.projectCount || data.projects.length} Projects (${data.partnerName || 'Partner'})`,
                    extraProjects: data.projects,
                    totalAmount: data.totalAmount || data.projects.reduce((sum: number, projectEntry: SettlementProjectEntry) => sum + (Number(projectEntry.fee) || 0), 0)
                }
            }
        } catch {
            // fallback if not JSON
        }

        const projectIdMatch = details.match(/projectId=([^;]+)/)
        if (projectIdMatch) {
            const projectId = projectIdMatch[1]
            const project = projects.find((projectEntry) => projectEntry.id === projectId)
            // Try to extract fee from log details if possible (manual toggle might not store fee, so we check project)
            const feeMatch = details.match(/fee=([^;]+)/)
            const amountMatch = details.match(/amount=([^;]+)/)
            const fee = feeMatch ? Number(feeMatch[1]) : (amountMatch ? Number(amountMatch[1]) : toProjectFee(project?.currentFee))

            if (project) {
                return {
                    projectName: formatProjectName(project),
                    extraProjects: [],
                    totalAmount: fee
                }
            } else {
                // Return something even if project not found, using the captured amount
                if (amountMatch || feeMatch) {
                     return {
                         projectName: "Ad-Hoc Payment",
                         extraProjects: [],
                         totalAmount: fee
                     }
                }
            }
        }

        return { projectName: "Unknown Project", extraProjects: [], totalAmount: 0 }
    }

    const getActionLabel = (action: string) => {
        switch (action) {
            case "PARTNER_AD_HOC_PAYMENT_ADDED":
                return "Manual Payment"
            case "PROJECT_PAYMENT_TOGGLED":
                return "Manual Toggle"
            case "SETTLE_PARTNER":
                return "Partner Settlement"
            case "SETTLE_PARTNER_VOIDED":
                return "Settlement Voided"
            default:
                return action
        }
    }

    if (logs.length === 0) {
        return (
            <ListEmptyState
                title="No payment events found"
                description="Payment status changes and settlements will appear here."
                icon={<History className="h-5 w-5" />}
                className="mx-4 my-10"
            />
        )
    }

    return (
        <div className="overflow-x-auto pb-4 hidescrollbar">
            {/* Header */}
            <div className="mb-3 hidden rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-5 py-3 text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.03)] md:block md:min-w-[1200px]">
                <div className="grid w-full items-center gap-x-4 md:grid-cols-[340px_1fr_120px_150px_120px]">
                    <div className="ui-overline">Project / Partner</div>
                    <div className="ui-overline pl-4">Transaction action</div>
                    <div className="ui-overline text-right">Amount</div>
                    <div className="ui-overline text-center">Status</div>
                    <div className="ui-overline text-right">Date</div>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-2.5 md:min-w-[1200px]">
                {logs.map((log, index) => {
                    const { projectName, extraProjects, totalAmount } = parseDetails(log.details)
                    const isExpandable = extraProjects.length > 0
                    const isExpanded = expandedRows.has(log.id)

                    return (
                        <Fragment key={log.id}>
                            <div
                                className={cn(
                                    "group stagger-row-enter relative flex items-center rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] px-4 py-3 transition-all shadow-[0_4px_14px_rgba(15,23,42,0.03)] cursor-pointer hover:border-slate-300/80 hover:bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] md:px-5",
                                    isExpanded && "border-blue-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(239,246,255,0.8))] ring-1 ring-blue-500/10",
                                    log.status === "Unpaid" && "shadow-[0_4px_16px_rgba(244,63,94,0.05)]",
                                    log.status === "Paid" && "shadow-[0_4px_16px_rgba(16,185,129,0.05)]"
                                )}
                                style={{ animationDelay: `${index * 0.05}s` }}
                                onClick={() => toggleRow(log.id, isExpandable)}
                                role={isExpandable ? "button" : undefined}
                                tabIndex={isExpandable ? 0 : undefined}
                                onKeyDown={(event) => {
                                    if (!isExpandable) return
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        toggleRow(log.id, isExpandable)
                                    }
                                }}
                            >
                                <div className="grid w-full gap-y-3 md:grid-cols-[340px_1fr_120px_150px_120px] md:items-center md:gap-x-4 md:gap-y-0">
                                    {/* 1. Project */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            {isExpandable && (
                                                <div className={cn(
                                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all",
                                                    isExpanded ? "bg-blue-50 text-blue-600 rotate-90" : "bg-slate-50 text-slate-400 group-hover:text-blue-500"
                                                )}>
                                                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                </div>
                                            )}
                                            <span className={cn(
                                                "text-sm font-bold tracking-tight text-slate-900 line-clamp-1",
                                                isExpandable && "group-hover:text-primary transition-colors"
                                            )}>
                                                {projectName}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. Action */}
                                    <div className="flex items-center gap-2.5 md:pl-4">
                                        <span className="ui-overline min-w-[72px] md:hidden">Action</span>
                                        <div className={cn(
                                            "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                                            log.action === "SETTLE_PARTNER_VOIDED" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                        )}>
                                            {log.action === "SETTLE_PARTNER_VOIDED" ? (
                                                <Undo2 className="h-4 w-4" />
                                            ) : (
                                                <CreditCard className="h-4 w-4" />
                                            )}
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-700">
                                            {getActionLabel(log.action)}
                                        </span>
                                    </div>

                                    {/* 3. Total */}
                                    <div className="flex items-center justify-between gap-3 text-right md:block">
                                        <span className="ui-overline md:hidden">Amount</span>
                                        <span className={cn(
                                            "font-mono text-sm font-black tracking-tight",
                                            log.status === "Unpaid" ? "text-rose-600" : "text-slate-900"
                                        )}>
                                            {formatCurrency(totalAmount)}
                                        </span>
                                    </div>

                                    {/* 4. Status */}
                                    <div className="flex items-center justify-between gap-3 md:justify-center">
                                        <span className="ui-overline md:hidden">Status</span>
                                        <StatusChip tone={log.status === "Paid" ? "paid" : "unpaid"} size="sm" className="min-w-[86px] justify-center">
                                            {log.status === "Unpaid" ? "Unpaid" : log.status}
                                        </StatusChip>
                                    </div>

                                    {/* 5. Date */}
                                    <div className="flex items-center justify-between gap-3 text-right md:block">
                                        <span className="ui-overline md:hidden">Date</span>
                                        <span className="text-[12px] font-bold text-slate-500 tabular-nums">
                                            {formatRelativeDate(log.date)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content (Settlements) */}
                            {isExpanded && (extraProjects.length > 0) && (
                                <div className="mb-2 flex animate-in slide-in-from-top-2 fade-in duration-300">
                                    <div className="mr-1 flex-1 rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(247,250,252,0.96),rgba(239,246,255,0.82))] p-1.5 shadow-[0_4px_14px_rgba(15,23,42,0.03)] md:ml-10 md:mr-2">
                                        <div className="rounded-[16px] bg-white/80 p-4">
                                            <div className="mb-3 flex items-center gap-2">
                                                <History className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="ui-overline text-blue-700">Settlement breakdown</span>
                                            </div>
                                            <div className="space-y-2">
                                                {extraProjects.map((projectEntry) => (
                                                    <div key={projectEntry.id} className="flex items-center justify-between rounded-[14px] border border-slate-200/70 bg-white/90 px-4 py-2.5 transition-colors hover:bg-white">
                                                        <span className="text-sm font-bold text-slate-700">{projectEntry.name}</span>
                                                        <span className="font-mono text-xs font-black text-slate-900 pl-4">
                                                            {formatCurrency(projectEntry.fee)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Fragment>
                    )
                })}
            </div>
        </div>
    )
}
