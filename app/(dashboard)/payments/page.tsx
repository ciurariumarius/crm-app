import { Banknote } from "lucide-react"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { PaymentBalancesTable, type PaymentBalanceRow } from "@/components/payments/payment-balances-table"
import { UnpaidByPartnerChart } from "@/components/payments/unpaid-by-partner-chart"
import { PaymentsAddPaymentAction } from "@/components/payments/payments-add-payment-action"
import { PaymentsSearchInput } from "@/components/payments/payments-search-input"
import { HomeRevenueDistributionChart, type RevenueSourceProject } from "@/components/dashboard/home-revenue-distribution-chart"
import { formatCurrency, formatProjectName, serialize } from "@/lib/utils"
import { StatCard } from "@/components/ui/app-surface"
import { mergePaymentMethods } from "@/lib/payments/methods"

export const dynamic = "force-dynamic"
const PAGE_SIZE = 50

type UnpaidBalanceSplit = { total: number; recurring: number; oneTime: number }
function createUnpaidBalanceSplit(): UnpaidBalanceSplit { return { total: 0, recurring: 0, oneTime: 0 } }
function addUnpaidAmount(bucket: UnpaidBalanceSplit, amount: number, isRecurring: boolean) { bucket.total += amount; if (isRecurring) bucket.recurring += amount; else bucket.oneTime += amount }
function validDate(value?: string) { if (!value) return null; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date }

export default async function PaymentsPage({ searchParams }: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string; page?: string; type?: string; method?: string; balanceSort?: string; paidFrom?: string; paidTo?: string }>
}) {
    const session = await requireAuth()
    const params = await searchParams
    const q = params.q?.trim() || ""
    const projectId = params.projectId || "all"
    const partnerId = params.partnerId || "all"
    const type = params.type === "Recurring" || params.type === "OneTime" ? params.type : "All"
    const method = params.method || "all"
    const balanceSort = ["amount_desc", "amount_asc", "paid_recent"].includes(params.balanceSort || "") ? params.balanceSort! : "paid_recent"
    const paidFrom = params.paidFrom || ""
    const paidTo = params.paidTo || ""
    const requestedPage = Math.max(1, Number(params.page) || 1)

    const [projects, partners, allServices, user] = await Promise.all([
        prisma.project.findMany({ include: { site: { include: { partner: true } }, services: true } }),
        prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.service.findMany({ orderBy: { serviceName: "asc" } }),
        prisma.user.findFirst({ where: { id: session.userId }, select: { hourlyRate: true } }),
    ])

    const oneTimeServices = allServices.filter((service) => !service.isRecurring)
    const paymentServiceOptions = oneTimeServices.map((service) => ({ id: service.id, name: service.serviceName }))
    const partnerNameById = new Map(partners.map((partner) => [partner.id, partner.name]))
    const unpaidByPartnerMap = new Map<string, { id: string; name: string; totalUnpaid: number; unpaidProjects: { id: string; name: string; amount: number }[] }>()

    for (const project of projects) {
        if (project.paymentStatus !== "Unpaid") continue
        const partnerIdForProject = project.site.partnerId
        const existing = unpaidByPartnerMap.get(partnerIdForProject) ?? { id: partnerIdForProject, name: partnerNameById.get(partnerIdForProject) || "Unknown partner", totalUnpaid: 0, unpaidProjects: [] }
        const amount = Number(project.currentFee || 0)
        existing.totalUnpaid += amount
        existing.unpaidProjects.push({ id: project.id, name: formatProjectName(project), amount })
        unpaidByPartnerMap.set(partnerIdForProject, existing)
    }
    const unpaidByPartner = Array.from(unpaidByPartnerMap.values()).map((entry) => ({ ...entry, unpaidProjects: entry.unpaidProjects.sort((a, b) => b.amount - a.amount) })).sort((a, b) => b.totalUnpaid - a.totalUnpaid)

    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthUnpaid = createUnpaidBalanceSplit()
    const previousMonthsUnpaid = createUnpaidBalanceSplit()
    for (const project of projects) {
        if (project.paymentStatus !== "Unpaid") continue
        addUnpaidAmount(project.createdAt >= currentMonthStart ? currentMonthUnpaid : previousMonthsUnpaid, Number(project.currentFee || 0), project.services.some((service) => service.isRecurring))
    }
    const totalOutstanding = currentMonthUnpaid.total + previousMonthsUnpaid.total

    const fromDate = validDate(paidFrom)
    const toDate = validDate(paidTo)
    if (toDate) toDate.setHours(23, 59, 59, 999)
    const normalizedQ = q.toLocaleLowerCase("ro-RO")
    const filteredBalances = projects.filter((project) => {
        if (project.paymentStatus !== "Paid") return false
        const recurring = project.services.some((service) => service.isRecurring)
        const searchable = [formatProjectName(project), project.name, project.site.domainName, project.site.partner.name, project.paymentMethod, ...project.services.map((service) => service.serviceName)].filter(Boolean).join(" ").toLocaleLowerCase("ro-RO")
        if (normalizedQ && !searchable.includes(normalizedQ)) return false
        if (projectId !== "all" && project.id !== projectId) return false
        if (partnerId !== "all" && project.site.partnerId !== partnerId) return false
        if (type === "Recurring" && !recurring) return false
        if (type === "OneTime" && recurring) return false
        if (method !== "all" && project.paymentMethod !== method) return false
        if ((fromDate || toDate) && !project.paidAt) return false
        if (fromDate && project.paidAt && project.paidAt < fromDate) return false
        if (toDate && project.paidAt && project.paidAt > toDate) return false
        return true
    })
    filteredBalances.sort((left, right) => {
        if (balanceSort === "amount_desc") return Number(right.currentFee || 0) - Number(left.currentFee || 0)
        if (balanceSort === "amount_asc") return Number(left.currentFee || 0) - Number(right.currentFee || 0)
        return (right.paidAt?.getTime() || right.updatedAt.getTime()) - (left.paidAt?.getTime() || left.updatedAt.getTime())
    })
    const totalBalances = filteredBalances.length
    const totalPages = Math.max(1, Math.ceil(totalBalances / PAGE_SIZE))
    const page = Math.min(requestedPage, totalPages)
    const pageRows = filteredBalances.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const balanceRows = serialize(pageRows.map((project): PaymentBalanceRow => ({
        id: project.id,
        label: formatProjectName(project),
        domainName: project.site.domainName,
        partnerId: project.site.partnerId,
        partnerName: project.site.partner.name,
        serviceLabel: project.services.map((service) => service.serviceName).join(", ") || "No service",
        isRecurring: project.services.some((service) => service.isRecurring),
        currentFee: Number(project.currentFee || 0),
        paidAt: project.paidAt?.toISOString() || null,
        paymentMethod: project.paymentMethod,
    })))

    const revenueSourceProjects = serialize(projects.filter((project) => Number(project.currentFee || 0) > 0).map((project) => ({
        id: project.id,
        currentFee: Number(project.currentFee || 0),
        createdAt: project.createdAt.toISOString(),
        revenueType: project.services.some((service) => service.isRecurring) ? "recurring" : "one-time",
        label: formatProjectName(project),
        site: { id: project.site.id, domainName: project.site.domainName, partner: { id: project.site.partner.id, name: project.site.partner.name } },
        services: project.services.map((service) => ({ serviceName: service.serviceName, isRecurring: service.isRecurring })),
    }))) as RevenueSourceProject[]

    const paymentMethods = mergePaymentMethods(projects.map((project) => project.paymentMethod))
    const paidProjectOptions = projects
        .filter((project) => project.paymentStatus === "Paid")
        .map((project) => ({ id: project.id, name: formatProjectName(project) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    return (
        <div className="flex flex-col gap-8 pb-10 sm:gap-10">
            <AppPageHeader title="Payments" search={<PaymentsSearchInput />} mobileSearch={<PaymentsSearchInput />} primaryAction={<PaymentsAddPaymentAction partners={partners} services={paymentServiceOptions} paymentMethods={paymentMethods} />} mobilePrimaryAction={<PaymentsAddPaymentAction partners={partners} services={paymentServiceOptions} paymentMethods={paymentMethods} mobile />} />

            <section id="outstanding" className="scroll-mt-6">
                <StatCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="ui-overline text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Payments to receive</p>
                            <p className="mt-2 text-[38px] font-bold leading-none tracking-tight text-[var(--state-urgent)] sm:text-[46px]">{formatCurrency(totalOutstanding)}</p>
                        </div>
                        <div className="ui-state-danger flex h-11 w-11 items-center justify-center rounded-[12px] border">
                            <Banknote className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <BalanceSplit label="Current month" data={currentMonthUnpaid} />
                        <BalanceSplit label="Previous months" data={previousMonthsUnpaid} />
                    </div>
                </StatCard>
            </section>

            <UnpaidByPartnerChart partners={unpaidByPartner} />
            <section id="revenue-analysis" className="scroll-mt-6">
                <HomeRevenueDistributionChart sourceProjects={revenueSourceProjects} allServices={serialize(allServices)} hourlyRate={Number(user?.hourlyRate || 0)} />
            </section>

            <PaymentBalancesTable rows={balanceRows} projects={paidProjectOptions} partners={partners} paymentMethods={paymentMethods} filters={{ projectId, partnerId, type, method, sort: balanceSort, paidFrom, paidTo }} pagination={{ page, totalPages, total: totalBalances, prevPage: page > 1 ? page - 1 : null, nextPage: page < totalPages ? page + 1 : null }} />
        </div>
    )
}

function BalanceSplit({ label, data }: { label: string; data: UnpaidBalanceSplit }) {
    return (
        <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
                <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{formatCurrency(data.total)}</p>
            </div>
        </div>
    )
}
