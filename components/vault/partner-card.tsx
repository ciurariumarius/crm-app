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
        <Card className="h-full hover:bg-muted/30 transition-all group relative overflow-hidden border-muted/40 shadow-sm hover:shadow-md">
            {/* Background Link for Card */}
            <Link href={`/vault/${partner.id}`} className="absolute inset-0 z-0" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 z-10 relative border-b bg-muted/5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 border border-primary/10">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <CardTitle className="text-xl font-black italic tracking-tight uppercase leading-none">
                            {partner.name}
                        </CardTitle>
                        {partner.businessName && (
                            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] truncate max-w-[150px] mt-1">
                                {partner.businessName}
                            </span>
                        )}
                    </div>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="z-20 relative">
                    <EditPartnerDialog partner={partner as any} />
                </div>
            </CardHeader>

            <CardContent className="z-10 relative pt-6 space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                            <Briefcase className="h-3 w-3" /> Active Projects
                        </div>
                        <div className="text-2xl font-black italic tabular-nums leading-none">
                            {activeProjects}
                        </div>
                    </div>
                    <div className="space-y-1 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                            <CircleDollarSign className="h-3 w-3" /> Total Revenue
                        </div>
                        <div className="text-2xl font-black italic tabular-nums leading-none">
                            <span className="text-xs font-bold mr-1 italic text-muted-foreground/20">RON</span>
                            {totalRevenue.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Second Metrics Row - Total Projects */}
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-transparent group-hover:border-primary/5 transition-colors">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total Lifecycle Projects</span>
                    </div>
                    <span className="text-sm font-black italic text-primary">{totalProjects}</span>
                </div>

                {/* Status Indicators */}
                <div className="flex flex-col gap-3">
                    {unpaidRevenue > 0 ? (
                        <Link
                            href={`/projects?partnerId=${partner.id}&status=All&payment=Unpaid`}
                            className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl hover:bg-rose-500/10 transition-all group/unpaid z-20 relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-rose-500" />
                                <span className="text-[10px] font-black uppercase text-rose-600">UNPAID BALANCE</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black tabular-nums text-rose-600 italic">
                                    {unpaidRevenue.toLocaleString()} RON
                                </span>
                                <ArrowRight className="h-3 w-3 text-rose-500 opacity-0 group-hover/unpaid:opacity-100 transition-all translate-x-[-4px] group-hover/unpaid:translate-x-0" />
                            </div>
                        </Link>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-tighter">All Paid</span>
                            </div>
                            <span className="text-[9px] font-black text-emerald-600/60 italic uppercase tracking-widest">OK</span>
                        </div>
                    )}
                </div>

                {/* Navigation Links */}
                <div className="flex items-center gap-2 pt-4 border-t border-dashed">
                    <Link
                        href={`/projects?partnerId=${partner.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/5 hover:bg-primary text-primary hover:text-primary-foreground text-[10px] font-black uppercase tracking-widest transition-all z-20"
                        onClick={(e) => e.stopPropagation()}
                    >
                        View Projects
                    </Link>
                    <div className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest px-2">
                        {partner._count.sites} SITES
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
