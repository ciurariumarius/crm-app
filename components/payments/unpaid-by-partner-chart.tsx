"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react"

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

    React.useEffect(() => {
        setItems(partners)
    }, [partners])

    const totalUnpaid = React.useMemo(
        () => items.reduce((sum, partner) => sum + partner.totalUnpaid, 0),
        [items]
    )

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

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="ui-overline text-slate-500">Unpaid by partner</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Review unpaid totals and settle all partner projects in one click.
                    </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-600">Total unpaid</p>
                    <p className="mt-1 text-lg font-bold text-rose-700">{formatCurrency(totalUnpaid)}</p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-emerald-700">All partner balances are settled.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Partner</th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Projects</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total unpaid</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {items.map((partner) => {
                                    const isExpanded = expandedId === partner.id
                                    const isSettling = settlingId === partner.id
                                    return (
                                        <React.Fragment key={partner.id}>
                                            <tr className="align-middle">
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId((current) => (current === partner.id ? null : partner.id))}
                                                        className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-blue-600"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-slate-400" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-slate-400" />
                                                        )}
                                                        <span>{partner.name}</span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                    {partner.unpaidProjects.length} unpaid project{partner.unpaidProjects.length === 1 ? "" : "s"}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-sm font-bold text-rose-700">{formatCurrency(partner.totalUnpaid)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 rounded-lg border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                        onClick={() => handleMarkAllPaid(partner.id)}
                                                        disabled={isSettling}
                                                    >
                                                        {isSettling ? (
                                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                        )}
                                                        Mark all paid
                                                    </Button>
                                                </td>
                                            </tr>

                                            {isExpanded ? (
                                                <tr>
                                                    <td colSpan={4} className="bg-slate-50/50 px-4 py-3">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                                                Unpaid projects
                                                            </p>
                                                            <Link
                                                                href={`/projects?partnerId=${partner.id}&payment=Unpaid`}
                                                                className="text-xs font-semibold text-blue-600 hover:text-blue-500"
                                                            >
                                                                Open in projects
                                                            </Link>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {partner.unpaidProjects.map((project) => (
                                                                <div
                                                                    key={project.id}
                                                                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-medium text-slate-700">{project.name}</p>
                                                                    </div>
                                                                    <span className="shrink-0 text-xs font-bold text-slate-900">
                                                                        {formatCurrency(project.amount)}
                                                                    </span>
                                                                </div>
                                                            ))}
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
