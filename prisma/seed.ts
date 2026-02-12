import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Custom Seed Runner...")

    // 1. Create Partners
    const lms = await prisma.partner.upsert({
        where: { name: "LMS" },
        update: {},
        create: { name: "LMS", isMainJob: true },
    })

    const dot = await prisma.partner.upsert({
        where: { name: "DOT" },
        update: {},
        create: { name: "DOT", isMainJob: false },
    })

    // 2. Create Sites
    const site1 = await prisma.site.upsert({
        where: { domainName: "lms-platform.com" },
        update: { partnerId: lms.id },
        create: {
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
        where: { domainName: "dot-agency.ro" },
        update: { partnerId: dot.id },
        create: {
            partnerId: dot.id,
            domainName: "dot-agency.ro",
            gtmId: "GTM-XXXXXX",
        }
    })

    // 3. Create Services
    const gtmService = await prisma.service.upsert({
        where: { serviceName: "GTM Implementation" },
        update: {},
        create: {
            serviceName: "GTM Implementation",
            isRecurring: false,
            standardTasks: JSON.stringify(["Audit existing tags", "Setup GA4 Config", "Configure e-commerce events"]),
        }
    })

    const ppcService = await prisma.service.upsert({
        where: { serviceName: "PPC Monthly Management" },
        update: {},
        create: {
            serviceName: "PPC Monthly Management",
            isRecurring: true,
            standardTasks: JSON.stringify(["Keyword research", "Ad copy refresh", "Bid adjustment"]),
        }
    })

    // 4. Create Projects
    await (prisma.project as any).create({
        data: {
            siteId: site1.id,
            status: "Active",
            paymentStatus: "Paid",
            currentFee: (1000 as any),
            services: { connect: [{ id: gtmService.id }] }
        }
    })

    await (prisma.project as any).create({
        data: {
            siteId: site2.id,
            status: "Active",
            paymentStatus: "Unpaid",
            currentFee: (500 as any),
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
