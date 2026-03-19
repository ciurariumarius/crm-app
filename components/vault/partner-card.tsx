"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Globe, Briefcase, CheckSquare, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PartnerSheetContent } from "@/components/vault/partner-sheet-content"
import { cn, formatNumber } from "@/lib/utils"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { sidePanelClass } from "@/lib/ui/side-panels"

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
        <Card className="group relative border-slate-200/60 bg-white transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.07)] hover:border-slate-300">
            <div 
                onClick={() => setIsSheetOpen(true)}
                className="h-full cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setIsSheetOpen(true)}
            >
                <CardContent className="flex flex-col h-full p-0">
                    {/* Top Section: Branding & Vital Labels */}
                    <div className="p-6 pb-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className="text-lg font-black tracking-tight text-slate-900 group-hover:text-primary transition-colors truncate">
                                        {partner.name}
                                    </h3>
                                    {partner.isMainJob && (
                                        <Badge className="h-5 border-none bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider px-2">
                                            Main Job
                                        </Badge>
                                    )}
                                </div>
                                {partner.businessName && (
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{partner.businessName}</p>
                                )}
                            </div>
                            <Link
                                href={`/projects?partnerId=${partner.id}&status=All`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm"
                            >
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="mt-8 -mx-6 bg-slate-50/50 border-y border-slate-100/60 p-3 grid grid-cols-3 divide-x divide-slate-200/60">
                            <div className="flex items-center justify-center gap-2.5">
                                <Globe className="h-3.5 w-3.5 text-blue-500/70 shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-slate-900 tabular-nums leading-none">{partner._count.sites}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Domains</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2.5">
                                <Briefcase className="h-3.5 w-3.5 text-indigo-500/70 shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-slate-900 tabular-nums leading-none">{totalProjects}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Projects</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2.5">
                                <CheckSquare className="h-3.5 w-3.5 text-emerald-500/70 shrink-0" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-black text-slate-900 tabular-nums leading-none">{partner.totalTasks || 0}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none">Tasks</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mid Section: Highlights */}
                    <div className="px-6 py-4 flex items-center justify-between border-y border-slate-50 bg-slate-50/30">
                        <div className="space-y-1">
                            <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Lifetime Revenue</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-base font-black text-slate-900 tabular-nums">{formatNumber(totalRevenue)}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">RON</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                                unpaidRevenue > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                                {unpaidRevenue > 0 ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                {unpaidRevenue > 0 ? "Outstanding" : "Settled"}
                            </span>
                            {unpaidRevenue > 0 && (
                                <div className="flex items-baseline gap-1">
                                    <span className="text-base font-black text-rose-600 tabular-nums">{formatNumber(unpaidRevenue)}</span>
                                    <span className="text-[10px] font-bold text-rose-400 uppercase">RON</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Section: Mini Ledger */}
                    <div className="p-6 pt-5 bg-white space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unpaid Projects</h4>
                            {optimisticUnpaidProjects.length > 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleMarkAllPaid(); }}
                                    disabled={isSettling}
                                    className="inline-flex items-center gap-1.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                                >
                                    {isSettling ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    Mark All Paid
                                </button>
                            )}
                        </div>

                        {optimisticUnpaidProjects.length > 0 ? (
                            <div className="space-y-1">
                                {optimisticUnpaidProjects.slice(0, 3).map((project) => (
                                    <Link
                                        key={project.id}
                                        href={`/projects/${project.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="group/item flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
                                    >
                                        <span className="min-w-0 truncate text-xs font-bold text-slate-700 group-hover/item:text-blue-700 transition-colors">
                                            {project.name}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-black tabular-nums text-rose-600">
                                                {formatNumber(project.amount)}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-300 uppercase">RON</span>
                                        </div>
                                    </Link>
                                ))}
                                {optimisticUnpaidProjects.length > 3 && (
                                    <div className="text-center pt-2">
                                        <span className="text-[10px] font-bold text-slate-400 italic">
                                            + {optimisticUnpaidProjects.length - 3} more outstanding
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/30 p-4 justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Account crystal clear</span>
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
