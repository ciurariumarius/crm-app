import prisma from "@/lib/prisma"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { ServicesListView } from "@/components/services/services-list-view"
import { requireAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
    await requireAuth()
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
        <div className="flex flex-col gap-6 pb-8 sm:gap-8">
                <AppPageHeader
                    title="Services"
                    primaryAction={<CreateServiceDialog label="Add" showLabelOnMobile className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7" />}
                    mobilePrimaryAction={
                        <CreateServiceDialog
                            label="Add"
                            showLabelOnMobile
                            className="!h-11 !w-auto !min-w-0 !rounded-[12px] !px-6 !gap-2 !text-white xl:!px-7"
                        />
                    }
                />

            <ServicesListView services={services} />
        </div>
    )
}
