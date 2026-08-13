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
                <div className="h-6 w-6 rounded-md bg-[var(--state-warning-surface)] flex items-center justify-center text-[var(--state-warning)]">
                    <AlertTriangle className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-lg tracking-tight text-[var(--state-warning)]">Profitability Alerts</h4>
                <span className="text-sm font-medium text-[var(--state-warning)] ml-1 tracking-tight">Time sinks detected</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map(alert => (
                    <Card key={alert.projectId} className="p-4 border-[color:color-mix(in_srgb,var(--state-warning)_28%,var(--line-subtle))] bg-[var(--state-warning)] flex flex-col gap-3 relative overflow-hidden group">
                        <div className="flex justify-between items-start z-10">
                            <div className="space-y-1">
                                <h5 className="text-sm font-bold tracking-tight text-[var(--state-warning)]">{alert.projectName}</h5>
                                <div className="flex items-center gap-1 text-[var(--state-warning)]">
                                    <TrendingDown className="h-3 w-3" />
                                    <span className="text-xs font-semibold tracking-[0.03em]">Low margin warning</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-[var(--state-warning)]">{(alert.ratio * 100).toFixed(0)}%</span>
                                <p className="text-xs font-semibold tracking-[0.03em] text-[var(--state-warning)]">Budget burned</p>
                            </div>
                        </div>

                        <div className="h-2 w-full bg-[var(--state-warning)] rounded-full overflow-hidden mt-1 z-10">
                            <div
                                className={cn("h-full transition-all duration-1000", alert.ratio > 0.9 ? "bg-red-500" : "bg-[var(--state-warning)]")}
                                style={{ width: `${Math.min(alert.ratio * 100, 100)}%` }}
                            />
                        </div>

                        <div className="flex justify-between items-center z-10">
                            <p className="text-xs font-medium text-[var(--state-warning)]">
                                Labor ({alert.loggedValue.toFixed(0)} RON) vs Fee ({alert.fee.toFixed(0)} RON)
                            </p>
                            <button className="flex items-center gap-0.5 text-xs font-semibold tracking-[0.03em] text-[var(--state-warning)] transition-colors hover:text-[var(--state-warning)]">
                                Optimize <ArrowUpRight className="h-2.5 w-2.5" />
                            </button>
                        </div>

                        <div className="absolute top-0 right-0 h-16 w-16 bg-[var(--state-warning-surface)] blur-2xl group-hover:bg-[var(--state-warning)]/40 transition-all rounded-full -mr-8 -mt-8" />
                    </Card>
                ))}
            </div>
        </section>
    )
}
