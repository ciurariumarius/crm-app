"use client"

import { Card } from "@/components/ui/card"
import { cn, formatCurrency } from "@/lib/utils"
import { TrendingUp, Wallet, Clock, AlertCircle, RotateCw, Zap } from "lucide-react"

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
    const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' })
    const formattedUnpaid = formatCurrency(unpaidBalance)
    const displayRevenue = formatCurrency(monthlyRevenue)

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
            <Card className="premium-card p-6 flex flex-col gap-1 relative overflow-hidden group border-l-4 border-l-primary/20">
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
                        <h3 className="text-3xl font-bold tracking-tight">{displayRevenue}</h3>
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
            <Card className="premium-card p-6 flex flex-col gap-1 relative overflow-hidden group">
                <div className="flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects Overview</span>
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 z-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Primary: Live Projects */}
                    <div>
                        <h3 className="text-3xl font-bold tracking-tight text-blue-600">
                            {activeMonthlyProjects + activeOneTimeProjects}
                        </h3>
                        <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wider">Live Projects</p>

                        <div className="flex items-center gap-3 mt-4">
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100" title="Recurring Projects">
                                <RotateCw className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.5} />
                                <span className="text-sm font-black text-blue-700">{activeMonthlyProjects}</span>
                            </div>
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-indigo-50/50 rounded-xl border border-indigo-100" title="One-time Projects">
                                <Zap className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2.5} />
                                <span className="text-sm font-black text-indigo-700">{activeOneTimeProjects}</span>
                            </div>
                        </div>
                    </div>

                    {/* Secondary: Tasks & Hours Logged */}
                    <div className="sm:border-l sm:pl-6 border-border/50 flex flex-col justify-between py-1">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <h4 className="text-2xl font-bold tracking-tight text-slate-800">{activeTasks}</h4>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Tasks</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-dashed border-border/80 mt-4">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-lg font-bold text-slate-700">{billableHours.toFixed(1)}h</span>
                                <span className="text-[10px] font-medium text-muted-foreground italic">worked in {currentMonthName}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
            </Card>
        </div>
    )
}
