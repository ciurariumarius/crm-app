import prisma from "@/lib/prisma"
import { Globe, Search as SearchIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"

export const dynamic = "force-dynamic"

export default async function SitesPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; page?: string }>
}) {
    const { q, page: pageStr } = await searchParams
    const page = parseInt(pageStr || "1")
    const pageSize = 10
    const skip = (page - 1) * pageSize

    const where = q ? {
        OR: [
            { domainName: { contains: q } },
            { partner: { name: { contains: q } } }
        ]
    } : {}

    // Fetch sites with pagination
    const sitesPromise = prisma.site.findMany({
        where,
        skip,
        take: pageSize,
        include: {
            partner: true,
            _count: {
                select: { projects: true }
            }
        },
        orderBy: { domainName: "asc" }
    })

    const totalSitesPromise = prisma.site.count({ where })

    // Fetch partners for the "Add Site" dialog selection
    const partnersPromise = prisma.partner.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })

    const [sitesRaw, totalSites, partners] = await Promise.all([
        sitesPromise,
        totalSitesPromise,
        partnersPromise
    ])

    // Serialize for Client Component
    const sites = JSON.parse(JSON.stringify(sitesRaw))
    const totalPages = Math.ceil(totalSites / pageSize)

    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="flex h-10 items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <MobileMenuTrigger />
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground md:pl-0 leading-none flex items-center h-full">
                        Sites
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <CreateSiteDialog partners={partners as any} />
                </div>
            </div>

            {/* Filters & Search - Modern Layout */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <form action="/vault/sites" method="GET">
                        <Input
                            name="q"
                            placeholder="Search by domain, partner, ID..."
                            className="pl-12 h-12 bg-card/50 border-none shadow-none text-base font-medium placeholder:font-normal"
                            defaultValue={q}
                        />
                        <input type="hidden" name="page" value="1" />
                    </form>
                </div>
            </div>

            <SitesTable sites={sites} />

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                    <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">
                        Showing page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            asChild={page > 1}
                            disabled={page <= 1}
                            className="h-9 px-4 font-bold"
                        >
                            {page > 1 ? (
                                <Link href={`/vault/sites?page=${page - 1}${q ? `&q=${q}` : ""}`}>
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                                </Link>
                            ) : (
                                <span className="flex items-center">
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                                </span>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            asChild={page < totalPages}
                            disabled={page >= totalPages}
                            className="h-9 px-4 font-bold"
                        >
                            {page < totalPages ? (
                                <Link href={`/vault/sites?page=${page + 1}${q ? `&q=${q}` : ""}`}>
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </Link>
                            ) : (
                                <span className="flex items-center">
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
