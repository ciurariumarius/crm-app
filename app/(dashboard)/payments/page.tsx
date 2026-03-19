import { getPaymentLogs } from "@/lib/actions/payment-actions"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { PageHeader } from "@/components/layout/page-header"
import { PaymentsTable } from "@/components/payments/payments-table"
import { PaymentsFilters } from "@/components/payments/payments-filters"
import { AddPartnerPaymentDialog } from "@/components/payments/add-partner-payment-dialog"
import Link from "next/link"

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string; page?: string }>
}) {
    const session = await requireTenantContext()
    const { projectId, partnerId, q, page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)

    const [projects, partners, logsResult] = await Promise.all([
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            include: { site: true, services: true }
        }),
        prisma.partner.findMany({
            where: { tenantId: session.tenantId },
            select: { id: true, name: true }
        }),
        getPaymentLogs({
            projectId,
            partnerId,
            q,
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
        })
    ])

    const logs = logsResult.success && logsResult.data ? logsResult.data : []
    const totalLogs = logsResult.success ? logsResult.total ?? logs.length : 0
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (projectId) next.set("projectId", projectId)
        if (partnerId) next.set("partnerId", partnerId)
        if (q) next.set("q", q)
        next.set("page", String(targetPage))
        return `/payments?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Payment Log"
                    description="Comprehensive history of all project payment status changes and settlements."
                />
                <AddPartnerPaymentDialog partners={partners} />
            </div>

            <div className="flex flex-col gap-6">
                <PaymentsFilters
                    partners={partners}
                    projects={projects}
                    totalLogs={totalLogs}
                />

                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-md transition-all">
                    <PaymentsTable
                        logs={logs}
                        projects={projects}
                    />

                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                            <span>Page {page} of {totalPages}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-200" />
                            <span>{totalLogs} events</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {prevPage ? (
                                <Link
                                    href={buildPageHref(prevPage)}
                                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                                >
                                    Previous
                                </Link>
                            ) : (
                                <span className="inline-flex h-9 items-center rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                                    Previous
                                </span>
                            )}
                            {nextPage ? (
                                <Link
                                    href={buildPageHref(nextPage)}
                                    className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                                >
                                    Next
                                </Link>
                            ) : (
                                <span className="inline-flex h-9 items-center rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                                    Next
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
