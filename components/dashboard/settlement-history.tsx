"use client"

import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { History, CheckCircle, CreditCard } from "lucide-react"

interface SettlementHistoryProps {
    history: { partnerName: string, amount: number, date: Date | string }[]
}

export function SettlementHistory({ history }: SettlementHistoryProps) {
    if (history.length === 0) return null

    return (
        <Card className="p-6 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-6 h-full">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <History className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Payment History</h3>
            </div>

            <div className="flex flex-col gap-3">
                {history.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/50 hover:border-emerald-500/30 transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                <CheckCircle className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-[11px] uppercase tracking-tight truncate">{item.partnerName}</h4>
                                <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                                    {format(new Date(item.date), 'MMM d, yyyy')}
                                </p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-xs font-black text-emerald-600">
                                <span className="text-[10px] opacity-50 mr-1">RON</span>
                                {item.amount.toLocaleString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {history.length > 3 && (
                <p className="text-center text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-50">
                    Showing last 3 entries
                </p>
            )}
        </Card>
    )
}
