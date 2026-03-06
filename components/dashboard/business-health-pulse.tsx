"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, Wallet, Clock, AlertCircle } from "lucide-react"

interface BusinessHealthPulseProps {
    monthlyRevenue: number
    formattedRevenue: string
    unpaidBalance: number
    billableHours: number
    activeTasks: number
    activeMonthlyProjects: number
    activeOneTimeProjects: number
    className?: string
}

export function BusinessHealthPulse({
    monthlyRevenue,
    formattedRevenue,
    unpaidBalance,
    billableHours,
    activeTasks,
    activeMonthlyProjects,
    activeOneTimeProjects,
    className
}: BusinessHealthPulseProps) {
    const currencyFormatter = new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })

    const formattedUnpaid = currencyFormatter.format(unpaidBalance)

    // Dynamic color for debt based on spec:
    // 0 = Neutral, > 0 = Warning Amber/Orange, > 1500 = Alert Red
    const debtAlert = unpaidBalance > 1500
    const debtWarning = unpaidBalance > 0

    const debtTextColor = debtAlert ? "text-red-600" : debtWarning ? "text-amber-600" : "text-foreground"
    const debtBadgeColor = debtAlert ? "bg-red-500/10 text-red-500" : debtWarning ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
    const debtBorderColor = debtAlert ? "border-l-red-500" : debtWarning ? "border-l-amber-500" : "border-l-border"

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", className)}>
            {/* Card A: Monthly Revenue */}
            <Card className="p-6 flex flex-col gap-1 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Revenue</span>
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 z-10">
                    <h3 className="text-3xl font-bold tracking-tight">{formattedRevenue}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Total billable active projects</p>
                </div>
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            </Card>

            {/* Card B: Debt Dash */}
            <Card className={cn("p-6 flex flex-col gap-1 relative overflow-hidden group hover:shadow-md transition-all border-l-4", debtBorderColor)}>
                <div className="flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Debt Dash</span>
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", debtBadgeColor)}>
                        <Wallet className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 z-10">
                    <h3 className={cn("text-3xl font-bold tracking-tight", debtTextColor)}>
                        {formattedUnpaid}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        {debtWarning ? (
                            <>
                                <AlertCircle className={cn("h-3 w-3", debtAlert ? "text-red-500" : "text-amber-500")} />
                                <p className={cn("text-xs font-medium tracking-tight", debtAlert ? "text-red-500" : "text-amber-500")}>
                                    {debtAlert ? "Urgent Action Required" : "Outstanding Balance Owed"}
                                </p>
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground">All accounts settled</p>
                        )}
                    </div>
                </div>
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors" />
            </Card>

            {/* Card C: Capacity & Workload */}
            <Card className="p-6 flex flex-col gap-1 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capacity & Workload</span>
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 z-10 space-y-3">
                    <div>
                        <h3 className="text-3xl font-bold tracking-tight">{billableHours.toFixed(1)}h Logged</h3>
                        <p className="text-xs text-muted-foreground mt-1">Billable effort this month</p>
                    </div>

                    <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Projects</p>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-sm font-black text-blue-600">{activeMonthlyProjects + activeOneTimeProjects}</span>
                                <span className="text-[8px] font-medium text-muted-foreground uppercase">Active</span>
                            </div>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[9px] font-medium bg-blue-50 text-blue-700 px-1 rounded">{activeMonthlyProjects}M</span>
                                <span className="text-[9px] font-medium bg-indigo-50 text-indigo-700 px-1 rounded">{activeOneTimeProjects}1T</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Tasks</p>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-sm font-black text-slate-700">{activeTasks}</span>
                                <span className="text-[8px] font-medium text-muted-foreground uppercase">Current</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
            </Card>
        </div>
    )
}
