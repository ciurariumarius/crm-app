import prisma from "@/lib/prisma"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import Link from "next/link"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { requireAuth } from "@/lib/auth"
import type { Prisma } from "@prisma/client"
import { buttonLinkClassName } from "@/components/ui/button-link"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50
const SORT_FIELDS = ["domainName", "partner", "projects", "createdAt"] as const
type DomainSort = (typeof SORT_FIELDS)[number]

function parseDateFilter(value: string | undefined, endOfDay = false) {
    if (!value) return undefined
    const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`)
    return Number.isNaN(date.getTime()) ? undefined : date
}

export default async function SitesPage({
    searchParams
}: {
    searchParams: Promise<{
        q?: string
        partnerId?: string
        projects?: "with" | "without"
        createdFrom?: string
        createdTo?: string
        page?: string
        sort?: string
        order?: "asc" | "desc"
    }>
}) {
    await requireAuth()
    const params = await searchParams
    const q = params.q?.trim() || ""
    const partnerId = params.partnerId || "all"
    const projectsFilter = params.projects === "with" || params.projects === "without" ? params.projects : "all"
    const createdFrom = params.createdFrom || ""
    const createdTo = params.createdTo || ""
    const sort: DomainSort = SORT_FIELDS.includes(params.sort as DomainSort) ? params.sort as DomainSort : "domainName"
    const order: "asc" | "desc" = params.order === "desc" ? "desc" : "asc"
    const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
    const skip = (page - 1) * PAGE_SIZE

    const where: Prisma.SiteWhereInput = {}
    
    if (q) {
        where.OR = [
            { domainName: { contains: q } },
            { partner: { name: { contains: q } } }
        ]
    }
    
    if (partnerId && partnerId !== "all") {
        where.partnerId = partnerId
    }
    if (projectsFilter === "with") where.projects = { some: {} }
    if (projectsFilter === "without") where.projects = { none: {} }

    const fromDate = parseDateFilter(createdFrom)
    const toDate = parseDateFilter(createdTo, true)
    if (fromDate || toDate) {
        where.createdAt = {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
        }
    }

    const orderBy: Prisma.SiteOrderByWithRelationInput = sort === "partner"
        ? { partner: { name: order } }
        : sort === "projects"
          ? { projects: { _count: order } }
          : { [sort]: order }

    // Fetch sites with pagination
    const sitesPromise = prisma.site.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        select: {
            id: true,
            partnerId: true,
            name: true,
            domainName: true,
            faviconHash: true,
            createdAt: true,
            updatedAt: true,
            partner: { select: { id: true, name: true } },
            _count: {
                select: { projects: true }
            }
        },
        orderBy,
    })

    const totalSitesPromise = prisma.site.count({ where })

    // Fetch partners for filters and dialog
    const partnersPromise = prisma.partner.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })

    const [sitesRaw, totalSites, partners] = await Promise.all([
        sitesPromise,
        totalSitesPromise,
        partnersPromise
    ])

    const totalPages = Math.ceil(totalSites / PAGE_SIZE)

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (partnerId && partnerId !== "all") next.set("partnerId", partnerId)
        if (projectsFilter !== "all") next.set("projects", projectsFilter)
        if (createdFrom) next.set("createdFrom", createdFrom)
        if (createdTo) next.set("createdTo", createdTo)
        if (sort !== "domainName") next.set("sort", sort)
        if (order !== "asc") next.set("order", order)
        next.set("page", String(targetPage))
        return `/domains?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-8 pb-8 sm:gap-10">
                <AppPageHeader
                    title="Domains"
                    primaryAction={<CreateSiteDialog partners={partners} label="Add" showLabelOnMobile className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7" />}
                    mobilePrimaryAction={
                        <CreateSiteDialog
                            partners={partners}
                            label="Add"
                            showLabelOnMobile
                            className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7"
                        />
                    }
                />

            <div className="space-y-6">
                <SitesTable 
                    sites={sitesRaw}
                    partners={partners}
                    totalSites={totalSites}
                    currentSort={sort}
                    currentOrder={order}
                    filters={{ q, partnerId, projects: projectsFilter, createdFrom, createdTo }}
                />
                
                {/* Pagination Footer */}
                <div className="flex items-center justify-between rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-3 py-2 shadow-[var(--shadow-apple)] sm:px-4">
                    <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                        {page}/{totalPages || 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {page > 1 ? (
                            <Link
                                href={buildPageHref(page - 1)}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-[var(--surface-low)] hover:text-blue-600" })}
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)]/70 text-[var(--text-muted)]" aria-hidden="true">
                                <ChevronLeft className="h-4 w-4" />
                            </span>
                        )}

                        {page < totalPages ? (
                            <Link
                                href={buildPageHref(page + 1)}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-[var(--surface-low)] hover:text-blue-600" })}
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)]/70 text-[var(--text-muted)]" aria-hidden="true">
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
