"use client"

import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { History, CheckCircle } from "lucide-react"

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
    if (history.length === 0) return null

    return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <History className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Payment History (Log)</h3>
            </div>

            <div className="flex flex-col gap-2">
                {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-background transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                <CheckCircle className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex flex-col">
                                <h4 className="font-bold text-sm uppercase tracking-tight truncate shrink-0">{item.projectName}</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.partnerName}</span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40 shrink-0">
                                        • {format(new Date(item.date), 'MMM d, yyyy')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-sm font-black text-emerald-600 tabular-nums">
                                {item.amount.toLocaleString()} <span className="text-[10px] opacity-50 ml-0.5 font-bold">RON</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {history.length >= 10 && (
                <p className="text-center text-[8px] text-muted-foreground uppercase font-bold tracking-widest opacity-50">
                    Showing last 10 entries
                </p>
            )}
        </Card>
    )
}
