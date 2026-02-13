import prisma from "@/lib/prisma"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { ServicesListView } from "@/components/services/services-list-view"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
    const servicesRaw = await prisma.service.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            projects: {
                select: { status: true }
            }
        },
    })

    const services = JSON.parse(JSON.stringify(servicesRaw))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Service Library</h2>
                    <p className="text-muted-foreground">Manage templates for your services.</p>
                </div>
                <CreateServiceDialog />
            </div>

            <ServicesListView services={services} />
        </div>
    )
}
