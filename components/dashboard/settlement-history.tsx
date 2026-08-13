"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { History, CheckCircle, ChevronRight } from "lucide-react"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"
import { cn, formatCurrency, formatRelativeDate } from "@/lib/utils"
import Link from "next/link"

interface SettlementHistoryProps {
    history: {
        id: string,
        projectName: string,
        partnerName: string,
        amount: number,
        date: Date | string
    }[]
}

export function SettlementHistory({ history }: SettlementHistoryProps) {
    const { openProject } = React.useContext(ProjectSheetContext)

    if (history.length === 0) return null

    // Limit to exactly 5 items as requested
    const displayHistory = history.slice(0, 5)

    return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <History className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-semibold text-sm text-muted-foreground">Payment history</h3>
                </div>
                <Link
                    href="/payments"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 group"
                >
                    View All
                    <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </div>

            <div className="flex flex-col gap-2">
                {displayHistory.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => openProject(item.id)}
                        className={cn(
                            "flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-emerald-50/20 transition-all group cursor-pointer active:scale-[0.99]",
                        )}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                <CheckCircle className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex flex-col">
                                <h4 className="font-semibold text-sm truncate shrink-0">{item.projectName}</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground font-medium">{item.partnerName}</span>
                                    <span className="text-xs text-muted-foreground font-medium opacity-60 shrink-0">
                                        • {formatRelativeDate(item.date)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-sm font-black text-emerald-600 tabular-nums">
                                {formatCurrency(item.amount)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {history.length > 5 && (
                <div className="mt-auto pt-2 border-t border-border/50">
                    <p className="text-center text-xs text-muted-foreground font-medium opacity-60">
                        Showing latest 5 of {history.length} entries
                    </p>
                </div>
            )}
        </Card>
    )
}
