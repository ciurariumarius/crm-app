"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Users, Briefcase, CircleDollarSign, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EditPartnerDialog } from "@/components/vault/edit-partner-dialog"
import { cn, formatNumber } from "@/lib/utils"
import { settlePartnerDebt } from "@/lib/actions/settlement"

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
            id: string
            name: string | null
            createdAt: string | Date
            status: string
            paymentStatus: string
            currentFee: number | null
            services?: { serviceName: string; isRecurring?: boolean }[]
        }[]
    }[]
    unpaidProjects?: {
        id: string
        name: string
        amount: number
    }[]
}

export function PartnerCard({ partner }: { partner: Partner }) {
    const router = useRouter()
    const [isSettling, setIsSettling] = useState(false)
    const [optimisticUnpaidProjects, setOptimisticUnpaidProjects] = useState(partner.unpaidProjects || [])

    // Calculate metrics
    const allProjects = partner.sites?.flatMap(s => s.projects) || []
    const totalProjects = allProjects.length
    const totalRevenue = allProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0)
    const unpaidRevenue = optimisticUnpaidProjects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const unpaidCount = optimisticUnpaidProjects.length

    const handleMarkAllPaid = async () => {
        if (optimisticUnpaidProjects.length === 0) return
        setIsSettling(true)
        try {
            const result = await settlePartnerDebt(partner.id)
            if (result.success) {
                setOptimisticUnpaidProjects([])
                toast.success(`Marked ${result.count} project${result.count === 1 ? "" : "s"} as paid`)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to mark projects as paid")
            }
        } catch {
            toast.error("Failed to mark projects as paid")
        } finally {
            setIsSettling(false)
        }
    }

    return (
        <Card className="group relative overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg hover:shadow-black/5 border-border bg-card hover:border-primary/20">
            <CardContent className="p-5 flex flex-col h-full gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 z-10 relative">
                    <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <Link
                                href={`/partners/${partner.id}`}
                                className="font-semibold text-[15px] leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors truncate hover:underline"
                            >
                                {partner.name}
                            </Link>
                            {partner.businessName && (
                                <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider px-1.5 h-5 flex items-center bg-muted/50 text-muted-foreground border-border/50 truncate max-w-[120px]">
                                    {partner.businessName}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/60 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 opacity-60" />
                                <span>{partner._count.sites} Sites</span>
                            </div>
                            <Link
                                href={`/projects?partnerId=${partner.id}&status=All`}
                                className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-2.5 py-1.5 text-blue-700 hover:bg-blue-100/60 transition-colors"
                            >
                                <Briefcase className="h-3.5 w-3.5 opacity-70" />
                                <span className="text-[20px] font-black leading-none tabular-nums">{totalProjects}</span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.08em]">Projects</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
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
                            {formatNumber(totalRevenue)} <span className="text-[9px] text-muted-foreground font-normal">RON</span>
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
                                ? `${formatNumber(unpaidRevenue)} RON`
                                : "All Paid"
                            }
                        </div>
                    </div>
                </div>

                {/* Unpaid projects breakdown */}
                <div className="z-10 relative rounded-lg border border-border/60 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            Outstanding projects
                        </p>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                            {unpaidCount} unpaid
                        </span>
                        <button
                            type="button"
                            onClick={handleMarkAllPaid}
                            disabled={isSettling || optimisticUnpaidProjects.length === 0}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors",
                                optimisticUnpaidProjects.length === 0
                                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            )}
                        >
                            {isSettling ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Mark all paid
                        </button>
                    </div>

                    {optimisticUnpaidProjects.length === 0 ? (
                        <p className="mt-2 text-xs font-medium text-emerald-700">No unpaid projects.</p>
                    ) : (
                        <div className="mt-2 space-y-1.5">
                            {optimisticUnpaidProjects.map((project) => (
                                <Link
                                    key={project.id}
                                    href={`/projects/${project.id}`}
                                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                                >
                                    <span className="min-w-0 truncate text-[11px] font-medium text-slate-700">
                                        {project.name}
                                    </span>
                                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-rose-600">
                                        {formatNumber(project.amount)} RON
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
