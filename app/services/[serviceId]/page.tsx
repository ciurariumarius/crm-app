import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ServiceSheetContent } from "@/components/services/service-sheet-content"
import { requireTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
    const session = await requireTenantContext()
    const { serviceId } = await params

    const serviceRaw = await prisma.service.findFirst({
        where: { id: serviceId, tenantId: session.tenantId }
    })

    if (!serviceRaw) {
        notFound()
    }

    const service = JSON.parse(JSON.stringify(serviceRaw))

    return (
        <div className="space-y-6">

            <div className="max-w-3xl mx-auto border rounded-xl overflow-hidden bg-background shadow-sm">
                <ServiceSheetContent service={service} />
            </div>
        </div>
    )
}
