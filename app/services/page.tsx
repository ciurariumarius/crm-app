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
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">Services</h1>
                </div>
                <CreateServiceDialog />
            </div>

            <ServicesListView services={services} />
        </div>
    )
}
