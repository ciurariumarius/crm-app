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
        <div className="flex flex-col gap-6">
            <div className="flex h-10 items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground pl-14 md:pl-0">
                    Services
                </h1>
                <CreateServiceDialog />
            </div>

            <ServicesListView services={services} />
        </div>
    )
}
