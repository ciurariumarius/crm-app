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
import { PartnerFilter } from "@/components/projects/partner-filter"

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
                <div className="space-y-1">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
                        Master <span className="text-primary">Projects</span>
                    </h2>
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60">Control Center / Global Audit</p>
                </div>
                <GlobalCreateProjectDialog partners={partnersFull as any} services={services as any} />
            </div>

            {/* Filters & Search UI */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-50" />
                    <form action="/projects" method="GET">
                        <Input
                            name="q"
                            placeholder="Search keywords..."
                            className="pl-10 h-11 border-none bg-card shadow-none text-sm font-medium"
                            defaultValue={q}
                        />
                        <input type="hidden" name="status" value={queryStatus} />
                        {partnerId && <input type="hidden" name="partnerId" value={partnerId} />}
                        {payment !== "All" && <input type="hidden" name="payment" value={payment} />}
                        {recurring !== "All" && <input type="hidden" name="recurring" value={recurring} />}
                    </form>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4">
                    <PartnerFilter partners={partnersList} currentPartnerId={partnerId} />

                    <div className="flex items-center gap-4">
                        {/* Recurring/One-Time Filter */}
                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-muted/50">
                            {[
                                { label: "ALL", value: "All" },
                                { label: "RECURRING", value: "Recurring" },
                                { label: "ONE-TIME", value: "OneTime" }
                            ].map((r) => (
                                <Link
                                    key={r.value}
                                    href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${r.value}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all flex items-center gap-1.5",
                                        recurring === r.value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {r.label}
                                </Link>
                            ))}
                        </div>

                        {/* Payment Status Filter */}
                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-muted/50">
                            {[
                                { label: "ALL", value: "All" },
                                { label: "PAID", value: "Paid" },
                                { label: "UNPAID", value: "Unpaid" }
                            ].map((p) => (
                                <Link
                                    key={p.value}
                                    href={`/projects?status=${queryStatus}&payment=${p.value}&recurring=${recurring}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all flex items-center gap-1.5",
                                        payment === p.value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {p.label}
                                </Link>
                            ))}
                        </div>

                        {/* Lifecycle Status Filter */}
                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-muted/50">
                            {["Active", "Paused", "Completed", "All"].map((s) => (
                                <Link
                                    key={s}
                                    href={`/projects?status=${s}&payment=${payment}&recurring=${recurring}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                                    className={cn(
                                        "px-4 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all",
                                        queryStatus === s
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {s}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Filter Chips */}
            {(partnerId || q || payment !== "All" || recurring !== "All") && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mr-2">Audit Active:</span>
                    {partnerId && filteredPartner && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}${q ? `&q=${q}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary border border-primary/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-colors"
                        >
                            Partner: {filteredPartner.name}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {recurring !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=All${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-violet-500/5 text-violet-600 border border-violet-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/10 transition-colors"
                        >
                            Type: {recurring === "Recurring" ? "Recurring" : "One-Time"}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {payment !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=All&recurring=${recurring}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1 border rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors",
                                payment === "Paid" ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10" : "bg-rose-500/5 text-rose-600 border-rose-500/20 hover:bg-rose-500/10"
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
                            className="flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground border border-muted-foreground/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-muted/80 transition-colors"
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

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ")
}
