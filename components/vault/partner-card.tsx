"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Globe, Briefcase, CheckSquare, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PartnerSheetContent } from "@/components/vault/partner-sheet-content"
import { formatNumber } from "@/lib/utils"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { sidePanelClass } from "@/lib/ui/side-panels"
import { StatusChip } from "@/components/ui/status-chip"
import { Button } from "@/components/ui/button"

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
    totalTasks?: number
}

export function PartnerCard({ partner }: { partner: Partner }) {
    const router = useRouter()
    const [isSettling, setIsSettling] = useState(false)
    const [optimisticUnpaidProjects, setOptimisticUnpaidProjects] = useState(partner.unpaidProjects || [])
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    // Calculate metrics
    const allProjects = partner.sites?.flatMap(s => s.projects) || []
    const totalProjects = allProjects.length
    const totalRevenue = allProjects.reduce((sum, p) => sum + (Number(p.currentFee) || 0), 0)
    const unpaidRevenue = optimisticUnpaidProjects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

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
        <Card className="group relative border-[var(--line-subtle)]/60 bg-[var(--surface-lowest)] transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.07)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]">
            <div 
                onClick={() => setIsSheetOpen(true)}
                className="h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded-xl"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setIsSheetOpen(true)
                    }
                }}
            >
                <CardContent className="flex flex-col h-full p-0">
                    {/* Top Section: Branding & Vital Labels */}
                    <div className="p-6 pb-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)] group-hover:text-primary transition-colors truncate">
                                        {partner.name}
                                    </h3>
                                    {partner.isMainJob && (
                                        <StatusChip tone="active" size="xs">
                                            Main Job
                                        </StatusChip>
                                    )}
                                </div>
                                {partner.businessName && (
                                    <p className="text-xs font-medium text-[var(--text-muted)]">{partner.businessName}</p>
                                )}
                            </div>
                            <Link
                                href={`/projects?partnerId=${partner.id}&status=All`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-muted)] hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                            >
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="mt-8 -mx-6 bg-[var(--surface-low)]/50 border-y border-[var(--line-subtle)]/60 p-3 grid grid-cols-3 divide-x divide-slate-200/60">
                            <div className="flex items-center justify-center gap-2.5">
                                <Globe className="h-3.5 w-3.5 text-blue-500/70 shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-[var(--text-primary)] tabular-nums leading-none">{partner._count.sites}</span>
                                    <span className="text-[11px] font-medium text-[var(--text-secondary)] leading-none">Domains</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2.5">
                                <Briefcase className="h-3.5 w-3.5 shrink-0 text-[var(--state-review)]" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-[var(--text-primary)] tabular-nums leading-none">{totalProjects}</span>
                                    <span className="text-[11px] font-medium text-[var(--text-secondary)] leading-none">Projects</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2.5">
                                <CheckSquare className="h-3.5 w-3.5 text-emerald-500/70 shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-[var(--text-primary)] tabular-nums leading-none">{partner.totalTasks || 0}</span>
                                    <span className="text-[11px] font-medium text-[var(--text-secondary)] leading-none">Tasks</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mid Section: Highlights */}
                    <div className="flex items-center justify-between border-y border-[var(--line-subtle)] px-6 py-4 bg-[var(--surface-low)]/30">
                        <div className="space-y-1">
                            <span className="block text-[11px] font-medium text-[var(--text-secondary)]">Lifetime revenue</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-base font-black text-[var(--text-primary)] tabular-nums">{formatNumber(totalRevenue)}</span>
                                <span className="text-[11px] font-medium text-[var(--text-muted)]">RON</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <StatusChip
                                tone={unpaidRevenue > 0 ? "outstanding" : "settled"}
                                size="xs"
                                icon={unpaidRevenue > 0 ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                            >
                                {unpaidRevenue > 0 ? "Outstanding" : "Settled"}
                            </StatusChip>
                            {unpaidRevenue > 0 && (
                                <div className="flex items-baseline gap-1">
                                    <span className="text-base font-black text-rose-600 tabular-nums">{formatNumber(unpaidRevenue)}</span>
                                    <span className="text-[11px] font-medium text-rose-400">RON</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Section: Mini Ledger */}
                    <div className="p-6 pt-5 bg-[var(--surface-lowest)] space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-secondary)]">Unpaid projects</h4>
                            {optimisticUnpaidProjects.length > 0 && (
                                <Button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleMarkAllPaid(); }}
                                    disabled={isSettling}
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                    {isSettling ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    Mark All Paid
                                </Button>
                            )}
                        </div>

                        {optimisticUnpaidProjects.length > 0 ? (
                            <div className="space-y-1">
                                {optimisticUnpaidProjects.slice(0, 3).map((project) => (
                                    <Link
                                        key={project.id}
                                        href={`/projects/${project.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="group/item flex items-center justify-between gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
                                    >
                                        <span className="min-w-0 truncate text-xs font-bold text-[var(--text-secondary)] group-hover/item:text-blue-700 transition-colors">
                                            {project.name}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-black tabular-nums text-rose-600">
                                                {formatNumber(project.amount)}
                                            </span>
                                            <span className="text-[11px] font-medium text-[var(--text-muted)]">RON</span>
                                        </div>
                                    </Link>
                                ))}
                                {optimisticUnpaidProjects.length > 3 && (
                                    <div className="text-center pt-2">
                                        <span className="text-[11px] font-medium text-[var(--text-muted)] italic">
                                            + {optimisticUnpaidProjects.length - 3} more outstanding
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/30 p-4 justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-[11px] font-semibold tracking-[0.03em] text-emerald-700">Account crystal clear</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </div>
            
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent 
                    side="right"
                    showCloseButton={false}
                    className={sidePanelClass("wide")}
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>Partner Details</SheetTitle>
                    </SheetHeader>
                    {isSheetOpen && (
                        <PartnerSheetContent
                            partnerId={partner.id}
                            onClose={() => setIsSheetOpen(false)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </Card>
    )
}
