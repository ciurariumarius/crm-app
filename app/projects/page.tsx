import prisma from "@/lib/prisma"
import Link from "next/link"
import { Briefcase, Globe, Users, Search as SearchIcon, Filter, X, CreditCard, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DetailedBreadcrumbs } from "@/components/layout/detailed-breadcrumbs"
import { formatDistanceToNow } from "date-fns"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { ProjectsTable } from "@/components/projects/projects-table"
import { ProjectsToolbar } from "@/components/projects/projects-toolbar"
import { cn } from "@/lib/utils"


export const dynamic = "force-dynamic"

export default async function MasterProjectsPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; status?: string; partnerId?: string; payment?: string; recurring?: string }>
}) {
    const params = await searchParams
    const queryStatus = params.status || "Active"
    const q = params.q
    const partnerId = params.partnerId
    const payment = params.payment || "All"
    const recurring = params.recurring || "All"

    // Fetch partner details if we have a partnerId filter
    const filteredPartner = partnerId
        ? await prisma.partner.findUnique({ where: { id: partnerId } })
        : null

    // Fetch all projects with expanded details for the table view
    const projectsPromise = prisma.project.findMany({
        where: {
            AND: [
                queryStatus === "All" ? {} : { status: queryStatus },
                payment === "All" ? {} : { paymentStatus: payment },
                partnerId ? { site: { partnerId } } : {},
                recurring === "Recurring" ? { services: { some: { isRecurring: true } } } :
                    recurring === "OneTime" ? { services: { some: { isRecurring: false } } } : {},
                q ? {
                    OR: [
                        { name: { contains: q } },
                        { site: { domainName: { contains: q } } },
                        { services: { some: { serviceName: { contains: q } } } },
                        { site: { partner: { name: { contains: q } } } }
                    ]
                } : {}
            ]
        },
        include: {
            site: {
                include: {
                    partner: true
                }
            },
            services: true,
            tasks: true,
            _count: {
                select: { tasks: true }
            }
        },
        orderBy: { updatedAt: "desc" }
    })

    // Fetch data for context
    const partnersPromise = prisma.partner.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })

    // Reuse partnersPromise for the dialog as well
    const partnersFullPromise = prisma.partner.findMany({
        include: {
            sites: {
                select: { id: true, domainName: true }
            }
        },
        orderBy: { name: "asc" }
    })

    const servicesPromise = prisma.service.findMany({
        orderBy: { serviceName: "asc" }
    })

    const [projectsRaw, partnersListRaw, partnersFullRaw, servicesRaw] = await Promise.all([
        projectsPromise,
        partnersPromise,
        partnersFullPromise,
        servicesPromise
    ])

    const projects = JSON.parse(JSON.stringify(projectsRaw))
    const partnersList = JSON.parse(JSON.stringify(partnersListRaw))
    const partnersFull = JSON.parse(JSON.stringify(partnersFullRaw))
    const services = JSON.parse(JSON.stringify(servicesRaw))

    return (
        <div className="space-y-6">
            <DetailedBreadcrumbs items={[
                { label: "Projects" }
            ]} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">
                        Projects
                    </h1>

                </div>
                <GlobalCreateProjectDialog partners={partnersFull as any} services={services as any} />
            </div>

            {/* Unified Filter Toolbar */}
            <ProjectsToolbar partners={partnersList} />

            {/* Active Filter Chips */}
            {(partnerId || q || payment !== "All" || recurring !== "All") && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mr-2">Filters Active:</span>
                    {partnerId && filteredPartner && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}${q ? `&q=${q}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary border border-primary/20 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-primary/10 transition-colors"
                        >
                            Partner: {filteredPartner.name}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {recurring !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=All${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-violet-500/5 text-violet-400 border border-violet-500/20 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-violet-500/10 transition-colors"
                        >
                            Type: {recurring === "Recurring" ? "Recurring" : "One-Time"}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {payment !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=All&recurring=${recurring}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1 border rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-colors",
                                payment === "Paid" ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10" : "bg-rose-500/5 text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
                            )}
                        >
                            {payment === "Paid" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            Payment: {payment}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {q && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] text-muted-foreground border border-white/[0.05] rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-white/[0.06] transition-colors"
                        >
                            Search: {q}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                </div>
            )}

            <ProjectsTable projects={projects} allServices={services} />
        </div>
    )
}
