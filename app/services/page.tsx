import prisma from "@/lib/prisma"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { ServicesListView } from "@/components/services/services-list-view"
import { requireTenantContext } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
    const session = await requireTenantContext()
    const servicesRaw = await prisma.service.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        include: {
            projects: {
                select: { status: true }
            }
        },
    })

    const services = JSON.parse(JSON.stringify(servicesRaw))

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Services" actions={<CreateServiceDialog />} />

            <ServicesListView services={services} />
        </div>
    )
}
