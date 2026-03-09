"use client"

import { useState, Fragment } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { cn, formatNumber, formatRelativeDate } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { CreditCard, History, Undo2, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PaymentsTableProps {
    logs: any[]
    projects: any[]
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

    const parseDetails = (details: string | null) => {
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
                    totalAmount: data.totalAmount || data.projects.reduce((sum: number, p: any) => sum + (Number(p.fee) || 0), 0)
                }
            }
        } catch {
            // fallback if not JSON
        }

        const projectIdMatch = details.match(/projectId=([^;]+)/)
        if (projectIdMatch) {
            const projectId = projectIdMatch[1]
            const project = projects.find(p => p.id === projectId)
            // Try to extract fee from log details if possible (manual toggle might not store fee, so we check project)
            const feeMatch = details.match(/fee=([^;]+)/)
            const fee = feeMatch ? Number(feeMatch[1]) : Number(project?.currentFee || 0)

            if (project) {
                return {
                    projectName: project.name || `${project.site?.domainName || 'Unknown site'}`,
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
        <div className="overflow-x-auto">
            <Table className="table-cockpit">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => {
                        const { projectName, extraProjects, totalAmount } = parseDetails(log.details)
                        const isExpandable = extraProjects.length > 0
                        const isExpanded = expandedRows.has(log.id)

                        return (
                            <Fragment key={log.id}>
                                <TableRow className={cn(isExpanded && "bg-muted/30 border-b-0")}>
                                    <TableCell>
                                        {isExpandable && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground"
                                                onClick={() => toggleRow(log.id, isExpandable)}
                                            >
                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap font-medium text-xs">
                                        {formatRelativeDate(log.date)}
                                    </TableCell>
                                    <TableCell
                                        className={cn("cursor-default", isExpandable && "cursor-pointer group")}
                                        onClick={() => toggleRow(log.id, isExpandable)}
                                    >
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "font-semibold text-sm",
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
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {getActionLabel(log.action)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-sm">
                                        ${formatNumber(totalAmount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "font-bold uppercase tracking-tighter transition-all",
                                                log.status === "Paid"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                            )}
                                        >
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-0">
                                        <TableCell colSpan={6} className="pb-4 pt-0 px-12">
                                            <div className="rounded-xl border border-border bg-card/80 overflow-hidden shadow-sm">
                                                <Table className="table-cockpit">
                                                    <TableHeader className="bg-muted/50">
                                                        <TableRow>
                                                            <TableHead className="h-8 text-[10px] uppercase font-bold tracking-widest px-4">Project Name</TableHead>
                                                            <TableHead className="h-8 text-[10px] uppercase font-bold tracking-widest text-right px-4">Fee</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {extraProjects.map((p: any) => (
                                                            <TableRow key={p.id} className="hover:bg-muted/20 border-border/50 last:border-0">
                                                                <TableCell className="py-2.5 text-xs font-semibold px-4">
                                                                    {p.name}
                                                                </TableCell>
                                                                <TableCell className="py-2.5 text-xs text-right font-mono px-4 text-muted-foreground">
                                                                    ${formatNumber(p.fee)}
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
