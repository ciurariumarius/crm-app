import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ServiceSheetContent } from "@/components/services/service-sheet-content"
import { requireAuth } from "@/lib/auth"
import { AppPageHeader } from "@/components/layout/app-page-header"

export const dynamic = "force-dynamic"

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
    await requireAuth()
    const { serviceId } = await params

    const serviceRaw = await prisma.service.findFirst({
        where: { id: serviceId }
    })

    if (!serviceRaw) {
        notFound()
    }

    const service = JSON.parse(JSON.stringify(serviceRaw))

    return (
        <div className="space-y-6">
            <AppPageHeader title={service.serviceName || "Service"} subtitle="Service configuration and standard delivery tasks." />

            <div className="mx-auto max-w-3xl overflow-hidden rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] shadow-[var(--shadow-apple)]">
                <ServiceSheetContent service={service} />
            </div>
        </div>
    )
}
