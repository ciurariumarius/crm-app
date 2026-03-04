import { PrismaClient } from "@prisma/client"
import path from "path"

const prisma = new PrismaClient()
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

async function mergeTrackingServices() {
    console.log("🔄 Merging tracking services into 'Tracking - eCommerce'...\n")

    // Services to merge
    const servicesToMerge = [
        "Tracking - TikTok Pixel&Catalog - Shopify",
        "Tracking - eCom WP",
        "Tracking - GA4&GAds - Shopify"
    ]

    // Find or create the unified service
    const unifiedService = await prisma.service.upsert({
        where: { tenantId_serviceName: { tenantId: DEFAULT_TENANT_ID, serviceName: "Tracking - eCommerce" } },
        update: {},
        create: {
            tenantId: DEFAULT_TENANT_ID,
            serviceName: "Tracking - eCommerce",
            isRecurring: false,
            standardTasks: JSON.stringify([
                "Setup Analytics",
                "Configure Pixels",
                "Test Tracking",
                "Documentation"
            ])
        }
    })

    console.log(`✅ Created/Found unified service: ${unifiedService.serviceName} (${unifiedService.id})\n`)

    // Find all services to merge
    const oldServices = await prisma.service.findMany({
        where: {
            tenantId: DEFAULT_TENANT_ID,
            serviceName: {
                in: servicesToMerge
            }
        },
        include: {
            projects: true
        }
    })

    console.log(`📊 Found ${oldServices.length} services to merge:\n`)

    let totalProjectsUpdated = 0

    for (const oldService of oldServices) {
        console.log(`\n🔍 Processing: ${oldService.serviceName}`)
        console.log(`   Projects using this service: ${oldService.projects.length}`)

        // Update all projects using this service
        for (const project of oldService.projects) {
            try {
                // Get current service IDs
                const currentProject = await prisma.project.findUnique({
                    where: { id: project.id },
                    include: { services: true }
                })

                if (!currentProject) continue

                // Remove old service, add new unified service
                const currentServiceIds = currentProject.services.map(s => s.id)
                const filteredIds = currentServiceIds.filter(id => id !== oldService.id)

                // Add unified service if not already present
                if (!filteredIds.includes(unifiedService.id)) {
                    filteredIds.push(unifiedService.id)
                }

                // Update project
                await prisma.project.update({
                    where: { id: project.id },
                    data: {
                        services: {
                            set: filteredIds.map(id => ({ id }))
                        }
                    }
                })

                totalProjectsUpdated++
                console.log(`   ✅ Updated project ${project.id}`)

            } catch (error: any) {
                console.error(`   ❌ Error updating project ${project.id}:`, error.message)
            }
        }

        // Delete the old service
        try {
            await prisma.service.delete({
                where: { id: oldService.id }
            })
            console.log(`   🗑️  Deleted old service: ${oldService.serviceName}`)
        } catch (error: any) {
            console.error(`   ❌ Error deleting service:`, error.message)
        }
    }

    console.log(`\n✨ Merge complete!`)
    console.log(`📊 Total projects updated: ${totalProjectsUpdated}`)

    // Verify
    const finalService = await prisma.service.findUnique({
        where: { tenantId_serviceName: { tenantId: DEFAULT_TENANT_ID, serviceName: "Tracking - eCommerce" } },
        include: {
            _count: {
                select: { projects: true }
            }
        }
    })

    console.log(`\n✅ Final service "Tracking - eCommerce" now has ${finalService?._count.projects} projects`)
}

mergeTrackingServices().finally(() => prisma.$disconnect())
