import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Custom Seed Runner...")

    const defaultTenantId = "00000000-0000-0000-0000-000000000001"
    const tenant = await prisma.tenant.upsert({
        where: { id: defaultTenantId },
        update: { name: "Default Tenant" },
        create: { id: defaultTenantId, name: "Default Tenant" },
    })

    // 0. Create Auth User
    const passwordHash = await bcrypt.hash("Marius123", 10)
    await prisma.user.upsert({
        where: { username: "mxa95" },
        update: {},
        create: {
            tenantId: tenant.id,
            username: "mxa95",
            passwordHash,
            twoFactorEnabled: false
        }
    })

    // 1. Create Partners
    const lms = await prisma.partner.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: "LMS" } },
        update: {},
        create: { tenantId: tenant.id, name: "LMS", isMainJob: true },
    })

    const dot = await prisma.partner.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: "DOT" } },
        update: {},
        create: { tenantId: tenant.id, name: "DOT", isMainJob: false },
    })

    // 2. Create Sites
    const site1 = await prisma.site.upsert({
        where: { tenantId_domainName: { tenantId: tenant.id, domainName: "lms-platform.com" } },
        update: { partnerId: lms.id },
        create: {
            tenantId: tenant.id,
            partnerId: lms.id,
            domainName: "lms-platform.com",
            driveLink: "https://drive.google.com/drive/u/0/folders/example",
            marketingVault: JSON.stringify({
                headlines: ["Learn faster", "Scale your team"],
                brandNotes: "Professional and blue.",
                competitors: ["Udemy", "Coursera"]
            })
        }
    })

    const site2 = await prisma.site.upsert({
        where: { tenantId_domainName: { tenantId: tenant.id, domainName: "dot-agency.ro" } },
        update: { partnerId: dot.id },
        create: {
            tenantId: tenant.id,
            partnerId: dot.id,
            domainName: "dot-agency.ro",
            gtmId: "GTM-XXXXXX",
        }
    })

    // 3. Create Services
    const gtmService = await prisma.service.upsert({
        where: { tenantId_serviceName: { tenantId: tenant.id, serviceName: "GTM Implementation" } },
        update: {},
        create: {
            tenantId: tenant.id,
            serviceName: "GTM Implementation",
            isRecurring: false,
            standardTasks: JSON.stringify(["Audit existing tags", "Setup GA4 Config", "Configure e-commerce events"]),
        }
    })

    const ppcService = await prisma.service.upsert({
        where: { tenantId_serviceName: { tenantId: tenant.id, serviceName: "PPC Monthly Management" } },
        update: {},
        create: {
            tenantId: tenant.id,
            serviceName: "PPC Monthly Management",
            isRecurring: true,
            standardTasks: JSON.stringify(["Keyword research", "Ad copy refresh", "Bid adjustment"]),
        }
    })

    // 4. Create Projects
    await prisma.project.create({
        data: {
            tenantId: tenant.id,
            siteId: site1.id,
            status: "Active",
            paymentStatus: "Paid",
            currentFee: 1000,
            services: { connect: [{ id: gtmService.id }] }
        }
    })

    await prisma.project.create({
        data: {
            tenantId: tenant.id,
            siteId: site2.id,
            status: "Active",
            paymentStatus: "Unpaid",
            currentFee: 500,
            services: { connect: [{ id: ppcService.id }] }
        }
    })

    console.log("Seeding completed.")
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
