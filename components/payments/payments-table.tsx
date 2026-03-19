"use client"

import { useState, Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency, formatProjectName, formatRelativeDate } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { CreditCard, History, Undo2, ChevronDown, ChevronRight } from "lucide-react"

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
            const fee = feeMatch ? Number(feeMatch[1]) : toProjectFee(project?.currentFee)

            if (project) {
                return {
                    projectName: formatProjectName(project),
                    extraProjects: [],
                    totalAmount: fee
                }
            }
        }

        return { projectName: "Unknown Project", extraProjects: [], totalAmount: 0 }
    }

    const getActionLabel = (action: string) => {
        switch (action) {
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <History className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No payment events found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                    Payment status changes and settlements will appear here.
                </p>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto px-6">
            <Table className="table-cockpit">
                <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold tracking-[0.03em] text-slate-500">Project</TableHead>
                        <TableHead className="text-[11px] font-semibold tracking-[0.03em] text-slate-500">Action</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold tracking-[0.03em] text-slate-500">Total</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold tracking-[0.03em] text-slate-500">Status</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold tracking-[0.03em] text-slate-500">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => {
                        const { projectName, extraProjects, totalAmount } = parseDetails(log.details)
                        const isExpandable = extraProjects.length > 0
                        const isExpanded = expandedRows.has(log.id)

                        return (
                            <Fragment key={log.id}>
                                <TableRow className={cn(
                                    "border-b border-slate-50 transition-colors hover:bg-slate-50/50",
                                    isExpanded && "bg-slate-50/50 border-b-0"
                                )}>
                                    <TableCell
                                        className={cn("cursor-default", isExpandable && "cursor-pointer group")}
                                        onClick={() => toggleRow(log.id, isExpandable)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {isExpandable && (
                                                <div className="text-muted-foreground/60 group-hover:text-blue-600 transition-colors">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </div>
                                            )}
                                            <span className={cn(
                                                "text-sm font-bold tracking-tight text-slate-800",
                                                isExpandable && "group-hover:text-blue-600 transition-colors"
                                            )}>
                                                {projectName}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {log.action === "SETTLE_PARTNER_VOIDED" ? (
                                                <Undo2 className="h-3.5 w-3.5 text-amber-500" />
                                            ) : (
                                                <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                                            )}
                                            <span className="text-[12px] font-medium text-muted-foreground">
                                                {getActionLabel(log.action)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-sm text-slate-900">
                                        {formatCurrency(totalAmount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "h-6 px-3 text-[11px] font-semibold tracking-[0.03em] transition-all",
                                                log.status === "Paid"
                                                    ? "bg-emerald-100/50 text-emerald-700 border-emerald-200"
                                                    : "bg-rose-100/50 text-rose-700 border-rose-200"
                                            )}
                                        >
                                            {log.status === "Paid" ? "Paid" : "Unpaid"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap text-[12px] font-medium text-slate-500">
                                        {formatRelativeDate(log.date)}
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-none">
                                        <TableCell colSpan={5} className="pb-4 pt-0 px-8">
                                            <div className="rounded-xl border border-slate-200 bg-white/50 overflow-hidden shadow-inner">
                                                <Table className="table-cockpit">
                                                    <TableHeader className="bg-muted/50">
                                                        <TableRow>
                                                            <TableHead className="h-8 px-4 text-[11px] font-semibold tracking-[0.03em] text-slate-500">Project name</TableHead>
                                                            <TableHead className="h-8 px-4 text-right text-[11px] font-semibold tracking-[0.03em] text-slate-500">Fee</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {extraProjects.map((projectEntry) => (
                                                            <TableRow key={projectEntry.id} className="hover:bg-slate-50/80 border-slate-100 last:border-0">
                                                                <TableCell className="py-2.5 px-4 text-[12px] font-semibold text-slate-600">
                                                                    {projectEntry.name}
                                                                </TableCell>
                                                                <TableCell className="py-2.5 px-4 text-right font-mono text-[12px] font-semibold text-slate-500">
                                                                    {formatCurrency(projectEntry.fee)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
