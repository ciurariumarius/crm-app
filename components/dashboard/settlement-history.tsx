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
        <section className="mt-12 pt-8 border-t border-border">
            <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <History className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Recent Settlement History</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {history.map((item, idx) => (
                    <Card key={idx} className="p-4 border border-border bg-card/30 backdrop-blur-sm flex items-center gap-4 group hover:border-emerald-200 transition-all">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm uppercase tracking-tight truncate">{item.partnerName}</h4>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                {format(new Date(item.date), 'MMMM d, yyyy')}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-sm font-black text-emerald-600 flex items-center gap-1 justify-end">
                                <span className="text-[10px] opacity-50">RON</span> {item.amount.toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1 justify-end text-muted-foreground">
                                <CreditCard className="h-2.5 w-2.5" />
                                <span className="text-[8px] font-bold uppercase tracking-widest">Bank Trf</span>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    )
}
