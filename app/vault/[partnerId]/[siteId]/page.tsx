import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { SiteDetail } from "@/components/vault/site-detail"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

export default async function SiteDetailPage({ params }: { params: Promise<{ partnerId: string, siteId: string }> }) {
    const { partnerId, siteId } = await params

    const sitePromise = prisma.site.findUnique({
        where: { id: siteId },
        include: {
            projects: {
                include: {
                    services: true,
                    _count: {
                        select: { tasks: true },
                    },
                },
                orderBy: { updatedAt: "desc" },
            },
            partner: true // Need partner name for breadcrumbs
        },
    })

    const servicesPromise = prisma.service.findMany({
        select: { id: true, serviceName: true, isRecurring: true, baseFee: true },
        orderBy: { serviceName: "asc" },
    })

    const partnersPromise = prisma.partner.findMany({
        include: { sites: { select: { id: true, domainName: true } } }
    })

    const [siteRaw, servicesRaw, partnersRaw] = await Promise.all([
        sitePromise,
        servicesPromise,
        partnersPromise
    ])

    if (!siteRaw) {
        notFound()
    }

    const site = JSON.parse(JSON.stringify(siteRaw))
    const services = JSON.parse(JSON.stringify(servicesRaw))
    const partners = JSON.parse(JSON.stringify(partnersRaw))

    return (
        <div className="space-y-8">
            <SiteDetail site={site} />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">Active Projects</h3>
                    <GlobalCreateProjectDialog
                        partners={partners as any}
                        services={services as any}
                        defaultPartnerId={site.partnerId}
                        defaultSiteId={site.id}
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {site.projects.map((project: any) => (
                        <Link key={project.id} href={`/projects/${project.id}`} className="transition-transform hover:scale-[1.02]">
                            <Card className="h-full">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base">
                                            {project.name || `${site.domainName} - ${project.services.map((s: any) => s.serviceName).join(" & ")}`}
                                        </CardTitle>
                                        <Badge variant={project.status === "Active" ? "default" : "secondary"}>
                                            {project.status}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Updated {formatDistanceToNow(project.updatedAt)} ago
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        {project._count.tasks} Tasks • {project.paymentStatus}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                    {site.projects.length === 0 && (
                        <div className="col-span-full text-center py-8 text-muted-foreground border-dashed border-2 rounded-lg">
                            No projects yet. Start one to track time and tasks.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
