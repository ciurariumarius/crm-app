"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { settlePartnerDebt, settleProject } from "@/lib/actions/settlement"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CheckCircle2, ChevronDown, Loader2, Check } from "lucide-react"

type UnpaidProject = {
    id: string
    name: string
    amount: number
}

type UnpaidPartner = {
    id: string
    name: string
    totalUnpaid: number
    unpaidProjects: UnpaidProject[]
}

type UnpaidByPartnerChartProps = {
    partners: UnpaidPartner[]
}

function sanitizeUnpaidPartners(list: UnpaidPartner[]): UnpaidPartner[] {
    return (list || [])
        .map((partner) => ({
            ...partner,
            unpaidProjects: (partner.unpaidProjects || []).filter((project) => project.amount > 0),
        }))
        .filter((partner) => partner.totalUnpaid > 0 && partner.unpaidProjects.length > 0)
}

export function UnpaidByPartnerChart({ partners }: UnpaidByPartnerChartProps) {
    const router = useRouter()
    const [items, setItems] = React.useState<UnpaidPartner[]>(() => sanitizeUnpaidPartners(partners))
    const [expandedId, setExpandedId] = React.useState<string | null>(null)
    const [settlingId, setSettlingId] = React.useState<string | null>(null)
    const [settlingProjectId, setSettlingProjectId] = React.useState<string | null>(null)

    React.useEffect(() => {
        setItems(sanitizeUnpaidPartners(partners))
    }, [partners])

    const handleMarkAllPaid = async (partnerId: string) => {
        setSettlingId(partnerId)
        try {
            const result = await settlePartnerDebt(partnerId)
            if (!result.success) {
                toast.error(result.error || "Failed to mark projects as paid")
                return
            }

            setItems((prev) => prev.filter((partner) => partner.id !== partnerId))
            if (expandedId === partnerId) setExpandedId(null)
            toast.success(`Marked ${result.count} project${result.count === 1 ? "" : "s"} as paid`, {
                description: "You can revert individual payments from Payments received.",
                duration: 4500,
            })
            router.refresh()
        } catch {
            toast.error("Failed to mark projects as paid")
        } finally {
            setSettlingId(null)
        }
    }

    const handleMarkProjectPaid = async (partnerId: string, projectId: string, amount: number) => {
        setSettlingProjectId(projectId)
        try {
            const result = await settleProject(projectId)
            if (!result.success) {
                toast.error(result.error || "Failed to mark project as paid")
                return
            }

            setItems((prev) => {
                const partner = prev.find(p => p.id === partnerId)
                if (!partner) return prev

                const remainingProjects = partner.unpaidProjects.filter(p => p.id !== projectId)
                if (remainingProjects.length === 0) {
                    return prev.filter(p => p.id !== partnerId)
                }

                return prev.map(p => {
                    if (p.id === partnerId) {
                        return {
                            ...p,
                            totalUnpaid: p.totalUnpaid - amount,
                            unpaidProjects: remainingProjects
                        }
                    }
                    return p
                })
            })
            
            toast.success(`Project marked as paid`)
            router.refresh()
        } catch {
            toast.error("Failed to mark project as paid")
        } finally {
            setSettlingProjectId(null)
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex flex-col">
                    <h2 className="ui-text-title-sm text-[var(--text-primary)]">Unpaid by partners</h2>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[color:color-mix(in_srgb,var(--brand-primary)_20%,var(--line-subtle))] bg-[var(--sidebar-accent)] px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-emerald-700">All partner balances are currently settled.</p>
                    <p className="mt-1 text-sm font-medium text-emerald-600/80">New unpaid projects will appear here automatically.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {items.map((partner) => {
                        const isExpanded = expandedId === partner.id
                        const isSettling = settlingId === partner.id
                        return (
                            <div key={partner.id} className="flex flex-col overflow-hidden rounded-[20px] border border-[var(--line-subtle)]/90 bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)] transition-all hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]/80">
                                <div className="flex flex-col p-5 gap-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="truncate text-[15px] font-bold text-[var(--text-primary)]">{partner.name}</span>
                                            <span className="text-xs font-medium text-[var(--text-secondary)] mt-0.5">
                                                {partner.unpaidProjects.length} unpaid project{partner.unpaidProjects.length === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <div className="flex shrink-0 pt-0.5">
                                            <span className="font-mono text-base font-black text-rose-600 tracking-tight">
                                                {formatCurrency(partner.totalUnpaid)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-[var(--line-subtle)]/80">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId((current) => (current === partner.id ? null : partner.id))}
                                            className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-low)] group"
                                        >
                                            <div className={cn(
                                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                                                isExpanded ? "rotate-180 border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]" : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                                            )}>
                                                <ChevronDown className="h-3 w-3" />
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--text-secondary)] group-hover:text-[var(--text-secondary)]">
                                                {isExpanded ? "Hide Details" : "View Details"}
                                            </span>
                                        </button>
                                        
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            className="h-8 rounded-xl border-emerald-100 bg-emerald-50/90 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-600 hover:bg-emerald-100"
                                            onClick={() => handleMarkAllPaid(partner.id)}
                                            disabled={isSettling}
                                        >
                                            {isSettling ? (
                                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                            )}
                                            Mark all paid
                                        </Button>
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="flex flex-col gap-4 border-t border-[var(--line-subtle)]/80 bg-[color:color-mix(in_srgb,var(--surface-low)_82%,var(--surface-lowest)_18%)] p-5">
                                        <div className="flex items-center justify-between">
                                            <span className="ui-overline text-[var(--text-muted)]">Breakdown</span>
                                            <Link
                                                href={`/projects?partnerId=${partner.id}&payment=Unpaid`}
                                                className="text-xs font-black uppercase tracking-wider text-blue-600 hover:text-blue-500"
                                            >
                                                View List
                                            </Link>
                                        </div>
                                        <div className="grid gap-2 outline-none">
                                            {partner.unpaidProjects.map((project) => {
                                                const isSettlingProj = settlingProjectId === project.id
                                                return (
                                                    <div
                                                        key={project.id}
                                                        className="flex flex-col gap-2 rounded-[16px] border border-[var(--line-subtle)]/80 bg-[var(--surface-lowest)] p-3 shadow-[var(--shadow-apple)]"
                                                    >
                                                        <span className="text-[13px] font-bold text-[var(--text-secondary)] line-clamp-1">{project.name}</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-mono text-sm font-black text-[var(--text-primary)]">
                                                                {formatCurrency(project.amount)}
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                className="h-8 rounded-xl border-emerald-100 bg-emerald-50/90 px-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-600 hover:bg-emerald-100"
                                                                onClick={() => handleMarkProjectPaid(partner.id, project.id, project.amount)}
                                                                disabled={isSettlingProj}
                                                            >
                                                                {isSettlingProj ? (
                                                                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                                                )}
                                                                Mark Paid
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
