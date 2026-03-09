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
    id?: string
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
    id,
    className
}: BusinessHealthPulseProps) {
    const currencyFormatter = new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })

    const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' })
    const formattedUnpaid = currencyFormatter.format(unpaidBalance)

    // Dynamic color for debt based on spec:
    // 0 = Neutral, > 0 = Warning Amber/Orange, > 1500 = Alert Red
    const debtAlert = unpaidBalance > 1500
    const debtWarning = unpaidBalance > 0

    const debtTextColor = debtAlert ? "text-red-600" : debtWarning ? "text-amber-600" : "text-foreground"
    const debtBadgeColor = debtAlert ? "bg-red-500/10 text-red-500" : debtWarning ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
    const debtBorderColor = debtAlert ? "border-l-red-500" : debtWarning ? "border-l-amber-500" : "border-l-border"

    return (
        <div id={id} className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", className)}>
            {/* Combined Card: Financial Health (Revenue + Debt) */}
            <Card className="p-6 flex flex-col gap-1 relative overflow-hidden group hover:shadow-md transition-all border-l-4 border-l-primary/10">
                <div className="flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financial Overview</span>
                    <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", debtBadgeColor)}>
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                </div>

                <div className="mt-2 z-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-3xl font-bold tracking-tight">{formattedRevenue}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{currentMonthName} Revenue</p>
                    </div>

                    <div className="sm:border-l sm:pl-6 border-border/50">
                        <h3 className={cn("text-3xl font-bold tracking-tight", debtTextColor)}>
                            {formattedUnpaid}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            {debtWarning ? (
                                <>
                                    <AlertCircle className={cn("h-3 w-3", debtAlert ? "text-red-500" : "text-amber-500")} />
                                    <p className={cn("text-xs font-medium tracking-tight", debtAlert ? "text-red-500" : "text-amber-500")}>
                                        Unpaid Projects
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">All accounts settled</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            </Card>

            {/* Card B: Capacity & Workload (Original Card C) */}
            <Card className="p-6 flex flex-col gap-1 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects Overview</span>
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 z-10 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-2xl font-bold tracking-tight">{billableHours.toFixed(1)}h</h3>
                            <p className="text-xs text-muted-foreground mt-1">Hours Worked</p>
                        </div>

                        <div className="flex items-center gap-6 sm:pl-4 sm:border-l border-border/50">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Projects</p>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-sm font-black text-blue-600">{activeMonthlyProjects + activeOneTimeProjects}</span>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase ml-1">Live</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tasks</p>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-sm font-black text-slate-700">{activeTasks}</span>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase ml-1">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
            </Card>
        </div>
    )
}
