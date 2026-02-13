"use client"

import Link from "next/link"
import { Users, Briefcase, CircleDollarSign, AlertCircle, LayoutGrid, CheckCircle2, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EditPartnerDialog } from "@/components/vault/edit-partner-dialog"
import { cn } from "@/lib/utils"

interface Partner {
    id: string
    name: string
    businessName: string | null
    isMainJob: boolean
    emailPrimary: string | null
    emailSecondary: string | null
    phone: string | null
    internalNotes: string | null
    _count: {
        sites: number
    }
    sites?: {
        projects: {
            status: string
            paymentStatus: string
            currentFee: number | null
        }[]
    }[]
}

export function PartnerCard({ partner }: { partner: Partner }) {
    // Calculate metrics
    const allProjects = partner.sites?.flatMap(s => s.projects) || []
    const totalProjects = allProjects.length
    const activeProjects = allProjects.filter(p => p.status === "Active").length
    const totalRevenue = allProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0)
    const unpaidRevenue = allProjects
        .filter(p => p.paymentStatus === "Unpaid")
        .reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0)

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg hover:shadow-black/5 border-border bg-card hover:border-primary/20">
            <Link href={`/vault/${partner.id}`} className="absolute inset-0 z-0" />

            <CardContent className="p-5 flex flex-col h-full gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 z-10 relative">
                    <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[15px] leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                                {partner.name}
                            </h3>
                            {partner.businessName && (
                                <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider px-1.5 h-5 flex items-center bg-muted/50 text-muted-foreground border-border/50 truncate max-w-[120px]">
                                    {partner.businessName}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/60">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 opacity-60" />
                                <span>{partner._count.sites} Sites</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Briefcase className="h-3 w-3 opacity-60" />
                                <span>{totalProjects} Projects</span>
                            </div>
                        </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                        <EditPartnerDialog partner={partner as any} />
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border/50 w-full" />

                {/* Financials & Status */}
                <div className="grid grid-cols-2 gap-2 z-10 relative mt-auto">
                    <div className="space-y-1 p-2 rounded-lg bg-muted/20 border border-border/50 group-hover:border-border transition-colors">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1">
                            <CircleDollarSign className="h-2.5 w-2.5" />
                            Lifetime
                        </div>
                        <div className="text-xs font-bold text-foreground tabular-nums">
                            {totalRevenue.toLocaleString()} <span className="text-[9px] text-muted-foreground font-normal">RON</span>
                        </div>
                    </div>

                    <div className={cn(
                        "space-y-1 p-2 rounded-lg border transition-colors",
                        unpaidRevenue > 0
                            ? "bg-rose-500/5 border-rose-500/10 text-rose-600"
                            : "bg-emerald-500/5 border-emerald-500/10 text-emerald-600"
                    )}>
                        <div className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 opacity-80">
                            {unpaidRevenue > 0 ? <AlertCircle className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                            {unpaidRevenue > 0 ? "Outstanding" : "Status"}
                        </div>
                        <div className="text-xs font-bold tabular-nums">
                            {unpaidRevenue > 0
                                ? `${unpaidRevenue.toLocaleString()} RON`
                                : "All Paid"
                            }
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
