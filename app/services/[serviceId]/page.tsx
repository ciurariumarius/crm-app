import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ServiceSheetContent } from "@/components/services/service-sheet-content"
import { DetailedBreadcrumbs } from "@/components/layout/detailed-breadcrumbs"

export const dynamic = "force-dynamic"

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
    const { serviceId } = await params

    const serviceRaw = await prisma.service.findUnique({
        where: { id: serviceId }
    })

    if (!serviceRaw) {
        notFound()
    }

    const service = JSON.parse(JSON.stringify(serviceRaw))

    return (
        <div className="space-y-6">
            <DetailedBreadcrumbs items={[
                { label: "Services", href: "/services" },
                { label: service.serviceName }
            ]} />

            <div className="max-w-3xl mx-auto border rounded-xl overflow-hidden bg-background shadow-sm">
                <ServiceSheetContent service={service} />
            </div>
        </div>
    )
}
