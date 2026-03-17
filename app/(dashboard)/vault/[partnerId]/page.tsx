import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { SitesListView } from "@/components/vault/sites-list-view"
import { requireTenantContext } from "@/lib/tenant"
import type { PartnerWithSites } from "@/types"
import type { Service } from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function PartnerDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
    const session = await requireTenantContext()
    const { partnerId } = await params

    const partnerPromise = prisma.partner.findFirst({
        where: { id: partnerId, tenantId: session.tenantId },
        include: {
            sites: {
                include: {
                    _count: { select: { projects: true } }
                },
                orderBy: { createdAt: "desc" }
            }
        }
    })

    const servicesPromise = prisma.service.findMany({
        where: { tenantId: session.tenantId },
        select: { id: true, serviceName: true, isRecurring: true, baseFee: true },
        orderBy: { serviceName: "asc" }
    })

    const partnersPromise = prisma.partner.findMany({
        where: { tenantId: session.tenantId },
        include: { sites: { select: { id: true, domainName: true } } }
    })

    const [partnerRaw, servicesRaw, partnersRaw] = await Promise.all([
        partnerPromise,
        servicesPromise,
        partnersPromise
    ])

    if (!partnerRaw) {
        notFound()
    }

    // Serialize Decimal objects
    const partner = JSON.parse(JSON.stringify(partnerRaw))
    const services = JSON.parse(JSON.stringify(servicesRaw)) as unknown as Service[]
    const partners = JSON.parse(JSON.stringify(partnersRaw)) as unknown as PartnerWithSites[]

    return (
        <div className="space-y-6">

            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="page-title">{partner.name}</h1>

                </div>
                <div className="flex items-center gap-2">
                    <GlobalCreateProjectDialog
                        partners={partners}
                        services={services}
                        defaultPartnerId={partner.id}
                    />
                    <CreateSiteDialog partnerId={partner.id} />
                </div>
            </div>

            {partner.internalNotes && (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="pt-6">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{partner.internalNotes}</p>
                    </CardContent>
                </Card>
            )}

            <SitesListView sites={partner.sites} partnerId={partner.id} />
        </div>
    )
}
