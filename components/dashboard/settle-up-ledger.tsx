"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SettlementPartner } from "@/types"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { toast } from "sonner"
import { Wallet, CheckCircle2, Loader2, Calendar } from "lucide-react"
import { format } from "date-fns"

interface SettleUpLedgerProps {
    partners: SettlementPartner[]
}

export function SettleUpLedger({ partners }: SettleUpLedgerProps) {
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

    if (partners.length === 0) return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col items-center justify-center gap-2 py-8 grayscale opacity-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Accounts Clear</p>
        </Card>
    )

    return (
        <Card className="p-4 border border-border bg-card/50 backdrop-blur-sm shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                    <Wallet className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Settle Up Ledger</h3>
            </div>

            <div className="space-y-3">
                {partners.map(partner => (
                    <div key={partner.id} className="group p-3 rounded-xl border border-border bg-background hover:border-red-500/30 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-sm group-hover:text-red-600 transition-colors uppercase tracking-tight">{partner.name}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span className="text-[10px] uppercase font-medium">Outst. Balance</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold text-red-600">{partner.totalUnpaid} RON</span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-1 text-[11px] font-bold h-8 border-red-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-none uppercase"
                            onClick={() => handleSettle(partner.id)}
                            disabled={settlingId === partner.id}
                        >
                            {settlingId === partner.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-3 w-3 mr-2" />
                            )}
                            Mark All Paid
                        </Button>
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-muted-foreground italic text-center mt-2 px-4">
                Updating ledger generates a payment audit log for monthly bookkeeping.
            </p>
        </Card>
    )
}
