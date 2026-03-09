"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { History, CheckCircle, ChevronDown, ChevronUp, Trash2, Loader2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { voidSettlement } from "@/lib/actions/settlement"
import { toast } from "sonner"

interface SettlementHistoryProps {
    history: {
        id: string,
        partnerName: string,
        amount: number,
        date: Date | string,
        projects?: { name: string, fee: number }[]
    }[]
}

export function SettlementHistory({ history }: SettlementHistoryProps) {
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
    const [voidingId, setVoidingId] = useState<string | null>(null)

    const handleVoid = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm("Are you sure you want to void this settlement? This will revert all projects to Unpaid.")) return

        setVoidingId(id)
        try {
            const result = await voidSettlement(id)
            if (result.success) {
                toast.success("Settled projects reverted to unpaid.")
            } else {
                toast.error(result.error || "Failed to void settlement")
            }
        } catch (error) {
            toast.error("An error occurred while voiding")
        } finally {
            setVoidingId(null)
        }
    }

    if (history.length === 0) return null

    return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <History className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Payment History</h3>
            </div>

            <div className="flex flex-col gap-2">
                {history.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                        <div
                            className={cn(
                                "flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-background transition-all group cursor-pointer relative",
                                expandedIdx === idx && "border-emerald-500/30 bg-background"
                            )}
                            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <CheckCircle className="h-4 w-4" />
                                </div>
                                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                                    <h4 className="font-bold text-sm uppercase tracking-tight truncate shrink-0">{item.partnerName}</h4>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40 shrink-0">
                                        • {format(new Date(item.date), 'MMM d, yyyy')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                                <div className="text-sm font-black text-emerald-600 tabular-nums">
                                    {item.amount.toLocaleString()} <span className="text-[10px] opacity-50 ml-0.5 font-bold">RON</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleVoid(e, item.id)}
                                        disabled={voidingId === item.id}
                                        className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground/30 hover:text-red-500 transition-all"
                                        title="Void settlement (Accidental Click)"
                                    >
                                        {voidingId === item.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <RotateCcw className="h-3 w-3" />
                                        )}
                                    </button>
                                    {expandedIdx === idx ? (
                                        <ChevronUp className="h-4 w-4 text-emerald-500 transition-colors" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground/30 group-hover:text-emerald-500 transition-colors" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {expandedIdx === idx && (
                            <div className="px-4 py-2 ml-10 space-y-2 animate-in slide-in-from-top-1 duration-200 border-l border-emerald-500/20">
                                {item.projects && item.projects.length > 0 ? (
                                    item.projects.map((proj, pIdx) => (
                                        <div key={pIdx} className="flex items-center justify-between text-[11px] py-1 border-b border-border/10 last:border-0 hover:bg-emerald-50/10 transition-colors">
                                            <span className="text-muted-foreground font-bold truncate max-w-[200px] uppercase">{proj.name}</span>
                                            <span className="font-black text-slate-500 tabular-nums">{Number(proj.fee).toLocaleString()} RON</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[10px] text-muted-foreground italic uppercase font-bold opacity-50">
                                        No project breakdown available for this entry.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {history.length > 3 && (
                <p className="text-center text-[8px] text-muted-foreground uppercase font-bold tracking-widest opacity-50">
                    Showing last 3 entries
                </p>
            )}
        </Card>
    )
}
