import prisma from "@/lib/prisma"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
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
            <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-[var(--shadow-apple)] sm:p-5 lg:p-6">
                <DashboardPageHeader
                    title="Services"
                    actions={<CreateServiceDialog label="Add" showLabelOnMobile className="!h-11 !w-auto !min-w-0 !rounded-[20px] !px-8 !gap-2 !text-white xl:!px-9" />}
                    mobileActions={
                        <CreateServiceDialog
                            label="Add"
                            showLabelOnMobile
                            className="!h-11 !w-auto !min-w-0 !rounded-[20px] !px-8 !gap-2 !text-white xl:!px-9"
                        />
                    }
                    showMobile
                />
            </div>

            <ServicesListView services={services} />
        </div>
    )
}
