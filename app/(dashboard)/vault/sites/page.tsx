import prisma from "@/lib/prisma"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { requireTenantContext } from "@/lib/tenant"
import { DomainsFilters } from "@/components/vault/domains-filters"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export default async function SitesPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; partnerId?: string; page?: string }>
}) {
    const session = await requireTenantContext()
    const { q, partnerId, page: pageStr } = await searchParams
    const page = parseInt(pageStr || "1")
    const skip = (page - 1) * PAGE_SIZE

    const where: any = { tenantId: session.tenantId }
    
    if (q) {
        where.OR = [
            { domainName: { contains: q } },
            { partner: { name: { contains: q } } }
        ]
    }
    
    if (partnerId && partnerId !== "all") {
        where.partnerId = partnerId
    }

    // Fetch sites with pagination
    const sitesPromise = prisma.site.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        include: {
            partner: true,
            _count: {
                select: { projects: true }
            }
        },
        orderBy: { domainName: "asc" }
    })

    const totalSitesPromise = prisma.site.count({ where })

    // Fetch partners for filters and dialog
    const partnersPromise = prisma.partner.findMany({
        where: { tenantId: session.tenantId },
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
        next.set("page", String(targetPage))
        return `/domains?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <PageHeader title="Domains" actions={<CreateSiteDialog partners={partners as any} />} />

            <DomainsFilters 
                partners={partners} 
                totalLogs={totalSites} 
            />

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-md transition-all">
                <SitesTable sites={sitesRaw} />
                
                {/* Pagination Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                        Page {page} of {totalPages || 1}
                    </p>
                    
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild={page > 1}
                            disabled={page <= 1}
                            className={cn(
                                "h-8 w-8 p-0 rounded-lg border border-slate-200 bg-white shadow-sm transition-all active:scale-95",
                                page <= 1 ? "opacity-40" : "hover:bg-slate-50 hover:text-blue-600"
                            )}
                        >
                            {page > 1 ? (
                                <Link href={buildPageHref(page - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Link>
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </Button>
                        
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild={page < totalPages}
                            disabled={page >= totalPages}
                            className={cn(
                                "h-8 w-8 p-0 rounded-lg border border-slate-200 bg-white shadow-sm transition-all active:scale-95",
                                page >= totalPages ? "opacity-40" : "hover:bg-slate-50 hover:text-blue-600"
                            )}
                        >
                            {page < totalPages ? (
                                <Link href={buildPageHref(page + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
