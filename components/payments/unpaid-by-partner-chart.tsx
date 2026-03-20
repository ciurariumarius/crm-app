"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { settlePartnerDebt } from "@/lib/actions/settlement"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react"

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

const COLORS = [
    "hsl(var(--chart-1, 221.2 83.2% 53.3%))",
    "hsl(var(--chart-2, 142.1 76.2% 36.3%))",
    "hsl(var(--chart-3, 47.9 95.8% 51.8%))",
    "hsl(var(--chart-4, 24.3 91.1% 65.1%))",
    "hsl(var(--chart-5, 346.8 77.2% 49.8%))",
    "#2563eb",
    "#0ea5e9",
    "#7c3aed",
]

type ChartTooltipPayload = {
    name: string
    value: number
    payload: { fill: string }
}

function ChartTooltip({
    active,
    payload,
}: {
    active?: boolean
    payload?: ChartTooltipPayload[]
}) {
    if (!active || !payload?.length) return null
    const item = payload[0]
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-slate-800">{item.name}</p>
            <p className="mt-1 text-xs font-bold text-slate-900">{formatCurrency(Number(item.value || 0))}</p>
        </div>
    )
}

export function UnpaidByPartnerChart({ partners }: UnpaidByPartnerChartProps) {
    const router = useRouter()
    const [items, setItems] = React.useState<UnpaidPartner[]>(partners)
    const [expandedId, setExpandedId] = React.useState<string | null>(null)
    const [settlingId, setSettlingId] = React.useState<string | null>(null)

    React.useEffect(() => {
        setItems(partners)
    }, [partners])

    const chartData = React.useMemo(
        () =>
            items.map((partner, index) => ({
                name: partner.name,
                value: partner.totalUnpaid,
                fill: COLORS[index % COLORS.length],
            })),
        [items]
    )

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
                <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={62}
                                        outerRadius={94}
                                        paddingAngle={3}
                                        stroke="transparent"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {items.map((partner) => {
                            const isExpanded = expandedId === partner.id
                            const isSettling = settlingId === partner.id
                            return (
                                <div key={partner.id} className="rounded-2xl border border-slate-200 bg-white">
                                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId((current) => (current === partner.id ? null : partner.id))}
                                            className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-slate-900">{partner.name}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {partner.unpaidProjects.length} unpaid project{partner.unpaidProjects.length === 1 ? "" : "s"}
                                                </p>
                                            </div>
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <span className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                                {formatCurrency(partner.totalUnpaid)}
                                            </span>
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
                                        </div>
                                    </div>

                                    {isExpanded ? (
                                        <div className="border-t border-slate-100 px-4 py-3">
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
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
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
                                        </div>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {items.length > 0 ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Tip: expand a partner row to see all unpaid projects and jump to filtered projects view.</span>
                </div>
            ) : null}
        </section>
    )
}
