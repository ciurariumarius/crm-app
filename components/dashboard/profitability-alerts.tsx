"use client"

import { Card } from "@/components/ui/card"
import { ProfitabilityAlert } from "@/types"
import { AlertTriangle, TrendingDown, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfitabilityAlertsProps {
    alerts: ProfitabilityAlert[]
}

export function ProfitabilityAlerts({ alerts }: ProfitabilityAlertsProps) {
    if (alerts.length === 0) return null

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-lg tracking-tight text-amber-900">Profitability Alerts</h4>
                <span className="text-sm font-medium text-amber-600 ml-1 tracking-tight">Time sinks detected</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map(alert => (
                    <Card key={alert.projectId} className="p-4 border-amber-200 bg-amber-50/50 flex flex-col gap-3 relative overflow-hidden group">
                        <div className="flex justify-between items-start z-10">
                            <div className="space-y-1">
                                <h5 className="text-sm font-bold tracking-tight text-amber-900">{alert.projectName}</h5>
                                <div className="flex items-center gap-1 text-amber-700/70">
                                    <TrendingDown className="h-3 w-3" />
                                    <span className="text-[11px] font-semibold tracking-[0.03em]">Low margin warning</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-amber-700">{(alert.ratio * 100).toFixed(0)}%</span>
                                <p className="text-[11px] font-semibold tracking-[0.03em] text-amber-600/70">Budget burned</p>
                            </div>
                        </div>

                        <div className="h-2 w-full bg-amber-200/50 rounded-full overflow-hidden mt-1 z-10">
                            <div
                                className={cn("h-full transition-all duration-1000", alert.ratio > 0.9 ? "bg-red-500" : "bg-amber-500")}
                                style={{ width: `${Math.min(alert.ratio * 100, 100)}%` }}
                            />
                        </div>

                        <div className="flex justify-between items-center z-10">
                            <p className="text-[11px] font-medium text-amber-800">
                                Labor ({alert.loggedValue.toFixed(0)} RON) vs Fee ({alert.fee.toFixed(0)} RON)
                            </p>
                            <button className="flex items-center gap-0.5 text-[11px] font-semibold tracking-[0.03em] text-amber-700 transition-colors hover:text-amber-900">
                                Optimize <ArrowUpRight className="h-2.5 w-2.5" />
                            </button>
                        </div>

                        <div className="absolute top-0 right-0 h-16 w-16 bg-amber-200/20 blur-2xl group-hover:bg-amber-200/40 transition-all rounded-full -mr-8 -mt-8" />
                    </Card>
                ))}
            </div>
        </section>
    )
}
