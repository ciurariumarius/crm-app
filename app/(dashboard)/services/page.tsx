import prisma from "@/lib/prisma"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
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
        <div className="flex flex-col gap-6 pb-8 sm:gap-8">
            <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                <DashboardPageHeader
                    title="Services"
                    actions={<CreateServiceDialog label="Add" className="!h-10 !w-auto !min-w-0 !rounded-[28px] !px-8 !gap-2 !text-white md:!px-9" />}
                    mobileActions={
                        <CreateServiceDialog
                            label="Add"
                            showLabelOnMobile
                            className="!h-10 !w-auto !min-w-0 !rounded-[28px] !px-8 !gap-2 !text-white md:!px-9"
                        />
                    }
                    showMobile
                />
            </div>

            <ServicesListView services={services} />
        </div>
    )
}
