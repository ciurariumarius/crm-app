import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ExternalLink, Globe, Plus } from "lucide-react"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { SitesListView } from "@/components/vault/sites-list-view"

export const dynamic = "force-dynamic"

export default async function PartnerDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
    const { partnerId } = await params

    const partnerPromise = prisma.partner.findUnique({
        where: { id: partnerId },
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
        select: { id: true, serviceName: true, isRecurring: true, baseFee: true },
        orderBy: { serviceName: "asc" }
    })

    const partnersPromise = prisma.partner.findMany({
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
    const services = JSON.parse(JSON.stringify(servicesRaw))
    const partners = JSON.parse(JSON.stringify(partnersRaw))

    return (
        <div className="space-y-6">

            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">{partner.name}</h1>

                </div>
                <div className="flex items-center gap-2">
                    <GlobalCreateProjectDialog
                        partners={partners as any}
                        services={services as any}
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
