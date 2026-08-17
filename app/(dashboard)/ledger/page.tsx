import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { togglePaymentStatus } from "@/lib/actions/projects"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusChip, statusToneFromLabel } from "@/components/ui/status-chip"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { requireAuth } from "@/lib/auth"
import Link from "next/link"
import { formatProjectName } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"
const PAGE_SIZE = 24
type LedgerProject = Prisma.ProjectGetPayload<{
    include: {
        site: { include: { partner: true } }
        services: true
    }
}>

export default async function LedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>
}) {
    await requireAuth()
    const { page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const activeProjectsWhere = {
        status: "Active" as const,
    }

    const [unpaidProjects, totalActiveProjects, timeByProject] = await Promise.all([
        prisma.project.findMany({
            where: activeProjectsWhere,
            include: {
                site: { include: { partner: true } },
                services: true,
            },
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prisma.project.count({ where: activeProjectsWhere }),
        prisma.timeLog.groupBy({
            by: ["projectId"],
            where: {
                startTime: { gte: startOfMonth },
            },
            _sum: { durationSeconds: true },
        }),
    ])

    const projectIds = timeByProject.flatMap((entry) => entry.projectId ? [entry.projectId] : [])
    const projectsForStats = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, site: { select: { partner: { select: { name: true } } } } },
    })
    const partnerByProject = new Map(projectsForStats.map((project) => [project.id, project.site.partner.name]))

    // Aggregate time by Partner
    const partnerStats: Record<string, number> = {}
    timeByProject.forEach((entry) => {
        if (!entry.projectId) return
        const partnerName = partnerByProject.get(entry.projectId)
        if (!partnerName) return
        partnerStats[partnerName] = (partnerStats[partnerName] || 0) + (entry._sum.durationSeconds || 0)
    })

    const totalPages = Math.max(1, Math.ceil(totalActiveProjects / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    return (
        <div className="space-y-6">
            <AppPageHeader title="The Ledger" subtitle="Track project payments and time reported this month." />

            <Tabs defaultValue="payments" className="w-full">
                <TabsList>
                    <TabsTrigger value="payments">Payment Tracker</TabsTrigger>
                    <TabsTrigger value="reports">Time Reports (This Month)</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {unpaidProjects.map((project: LedgerProject) => (
                            <Card key={project.id} className={project.paymentStatus === "Unpaid" ? "border-[color:color-mix(in_srgb,var(--state-urgent)_35%,var(--line-subtle))]" : ""}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                            {formatProjectName(project)}
                                            {project.currentFee != null && (
                                                <span className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--state-success)_26%,var(--line-subtle))] bg-[var(--state-success-surface)] px-2 py-1 text-sm font-medium text-[var(--state-success)]">
                                                    {Number(project.currentFee)} RON
                                                </span>
                                            )}
                                        </CardTitle>
                                        <CardDescription>{project.site.partner.name}</CardDescription>
                                    </div>
                                    <StatusChip tone={statusToneFromLabel(project.paymentStatus)} size="xs">
                                        {project.paymentStatus}
                                    </StatusChip>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-sm text-muted-foreground">{project.site.partner.name}</span>
                                        <form action={async () => {
                                            "use server"
                                            await togglePaymentStatus(project.id, project.paymentStatus)
                                        }}>
                                            <Button size="sm" variant={project.paymentStatus === "Paid" ? "outline" : "default"}>
                                                {project.paymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}
                                            </Button>
                                        </form>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {unpaidProjects.length === 0 && (
                            <div className="col-span-full text-center py-10 text-muted-foreground">
                                No active projects found.
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between rounded-[14px] border border-border/60 bg-card/50 px-3 py-2">
                        <span className="inline-flex h-9 items-center rounded-[10px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-semibold text-[var(--text-primary)]">
                            {page}/{totalPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                            {prevPage ? (
                                <Link
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-low)]"
                                    href={`/ledger?page=${prevPage}`}
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] opacity-50" aria-hidden="true">
                                    <ChevronLeft className="h-4 w-4" />
                                </span>
                            )}
                            {nextPage ? (
                                <Link
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-low)]"
                                    href={`/ledger?page=${nextPage}`}
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-muted)] opacity-50" aria-hidden="true">
                                    <ChevronRight className="h-4 w-4" />
                                </span>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="reports">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Overview ({format(new Date(), "MMMM yyyy")})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(partnerStats).map(([partner, seconds]) => {
                                    const hours = (seconds / 3600).toFixed(1)
                                    return (
                                        <div key={partner} className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-muted/50 p-2 rounded">
                                            <span className="font-medium">{partner}</span>
                                            <span className="font-mono">{hours} hrs</span>
                                        </div>
                                    )
                                })}
                                {Object.keys(partnerStats).length === 0 && (
                                    <div className="text-muted-foreground text-center py-4">No time logged this month.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
