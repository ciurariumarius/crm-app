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

export function UnpaidByPartnerChart({ partners }: UnpaidByPartnerChartProps) {
    const router = useRouter()
    const [items, setItems] = React.useState<UnpaidPartner[]>(partners)
    const [expandedId, setExpandedId] = React.useState<string | null>(null)
    const [settlingId, setSettlingId] = React.useState<string | null>(null)
    const [settlingProjectId, setSettlingProjectId] = React.useState<string | null>(null)

    React.useEffect(() => {
        setItems(partners)
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
            toast.success(`Marked ${result.count} project${result.count === 1 ? "" : "s"} as paid`)
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
                    <h2 className="ui-text-title-sm text-slate-900">Outstanding Balances</h2>
                    <p className="text-[11px] font-medium text-slate-400">
                        Settle partner projects to record payment events
                    </p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/30 px-4 py-6 text-center">
                    <p className="text-xs font-semibold text-emerald-600">All partner balances are currently settled.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                    <div className="overflow-x-auto hidescrollbar">
                        <table className="w-full min-w-[820px] text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Partner</th>
                                    <th className="px-6 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Projects</th>
                                    <th className="px-6 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Total unpaid</th>
                                    <th className="px-6 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.map((partner) => {
                                    const isExpanded = expandedId === partner.id
                                    const isSettling = settlingId === partner.id
                                    return (
                                        <React.Fragment key={partner.id}>
                                            <tr className={cn(
                                                "align-middle transition-colors hover:bg-slate-50/30",
                                                isExpanded && "bg-slate-50/20"
                                            )}>
                                                <td className="px-6 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId((current) => (current === partner.id ? null : partner.id))}
                                                        className="flex items-center gap-2 group"
                                                    >
                                                        <div className={cn(
                                                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                                                            isExpanded ? "bg-slate-100 border-slate-200 text-slate-600 rotate-180" : "bg-white border-slate-200 text-slate-400 group-hover:text-slate-600"
                                                        )}>
                                                            <ChevronDown className="h-3 w-3" />
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-900">{partner.name}</span>
                                                    </button>
                                                </td>
                                                <td className="px-6 py-3 text-xs font-bold text-slate-500">
                                                    {partner.unpaidProjects.length} unpaid project{partner.unpaidProjects.length === 1 ? "" : "s"}
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className="font-mono text-sm font-black text-rose-600">{formatCurrency(partner.totalUnpaid)}</span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-7 rounded-lg border-emerald-100 bg-emerald-50 px-2 text-[11px] font-black uppercase text-emerald-600 hover:bg-emerald-100"
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
                                                </td>
                                            </tr>

                                            {isExpanded ? (
                                                <tr>
                                                    <td colSpan={4} className="bg-slate-50/30 px-6 py-4">
                                                        <div className="flex flex-col gap-3 max-w-2xl ml-7">
                                                            <div className="flex items-center justify-between">
                                                                <span className="ui-overline text-slate-400">Breakdown</span>
                                                                <Link
                                                                    href={`/projects?partnerId=${partner.id}&payment=Unpaid`}
                                                                    className="text-[11px] font-black uppercase text-blue-600 hover:text-blue-500"
                                                                >
                                                                    View List
                                                                </Link>
                                                            </div>
                                                            <div className="grid gap-1.5">
                                                {partner.unpaidProjects.map((project) => {
                                                                    const isSettlingProj = settlingProjectId === project.id
                                                                    return (
                                                                        <div
                                                                            key={project.id}
                                                                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                                                                        >
                                                                            <span className="text-[13px] font-bold text-slate-700 truncate">{project.name}</span>
                                                                            <div className="flex items-center gap-6">
                                                                                <span className="font-mono text-sm font-black text-slate-900 border-r border-slate-100 pr-6">
                                                                                    {formatCurrency(project.amount)}
                                                                                </span>
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="secondary"
                                                                                    className="h-8 rounded-lg border-emerald-100 bg-emerald-50 px-3 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-100"
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
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    )
}
