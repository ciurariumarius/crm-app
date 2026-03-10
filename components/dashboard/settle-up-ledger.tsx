"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SettlementPartner } from "@/types"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { toast } from "sonner"
import { Wallet, CheckCircle2, Loader2, Calendar, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface SettleUpLedgerProps {
    partners: SettlementPartner[]
    id?: string
}

export function SettleUpLedger({ partners, id }: SettleUpLedgerProps) {
    const [settlingId, setSettlingId] = useState<string | null>(null)

    const handleSettle = async (partnerId: string) => {
        setSettlingId(partnerId)
        try {
            const result = await settlePartnerDebt(partnerId)
            if (result.success) {
                toast.success(`Settled ${result.amount} RON for partner!`)
            } else {
                toast.error(result.error || "Failed to settle debt")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setSettlingId(null)
        }
    }

    const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set())

    const togglePartner = (partnerId: string) => {
        const next = new Set(expandedPartners)
        if (next.has(partnerId)) next.delete(partnerId)
        else next.add(partnerId)
        setExpandedPartners(next)
    }

    if (partners.length === 0) return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col items-center justify-center gap-2 py-8 grayscale opacity-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Accounts Clear</p>
        </Card>
    )

    return (
        <Card id={id} className="p-6 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                        <Wallet className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Due Payment</h3>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {partners.map(partner => (
                    <div key={partner.id} className="flex flex-col gap-1">
                        <div
                            onClick={() => togglePartner(partner.id)}
                            className={cn(
                                "group flex items-center justify-between p-3 rounded-lg border border-border bg-background/30 hover:bg-background transition-all gap-4 cursor-pointer",
                                expandedPartners.has(partner.id) && "border-red-500/20 bg-background shadow-sm"
                            )}
                        >
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                {expandedPartners.has(partner.id) ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground/50" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 flex-1">
                                    <span className="font-bold text-xs uppercase tracking-tight truncate sm:w-48">{partner.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-medium text-muted-foreground">Owed Sum:</span>
                                        <span className="text-sm font-black text-red-600 tabular-nums">{partner.totalUnpaid} RON</span>
                                    </div>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] font-bold h-8 border-red-50/50 hover:bg-emerald-50/50 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-none uppercase px-4"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleSettle(partner.id)
                                }}
                                disabled={settlingId === partner.id}
                            >
                                {settlingId === partner.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                ) : (
                                    <CheckCircle2 className="h-3 w-3 mr-2" />
                                )}
                                Mark Paid
                            </Button>
                        </div>

                        {/* Unpaid Projects List */}
                        {expandedPartners.has(partner.id) && (
                            <div className="flex flex-col gap-1 pl-10 pr-3 pb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                {partner.unpaidProjects.map(project => (
                                    <div key={project.id} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0 group/project">
                                        <div className="flex items-center gap-2 flex-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                            <span className="text-[11px] font-medium text-muted-foreground leading-tight">{project.name}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-foreground tabular-nums">{project.amount} RON</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    )
}
