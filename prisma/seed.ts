import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"

const prisma = new PrismaClient()

async function main() {
    console.log("🚀 Custom Seed Runner...")

    // Keep exactly one application owner. Re-running the seed never creates a
    // second account and never changes the existing owner's credentials.
    const existingUsers = await prisma.user.findMany({ take: 2, orderBy: { createdAt: "asc" } })
    if (existingUsers.length > 1) {
        throw new Error("Single-owner invariant failed: more than one user exists")
    }
    if (existingUsers.length === 0) {
        const seedUsername = process.env.SEED_ADMIN_USERNAME?.trim() || "admin"
        const generatedPassword = randomBytes(18).toString("base64url")
        const configuredSeedPassword = process.env.SEED_ADMIN_PASSWORD?.trim()
        if (process.env.NODE_ENV === "production" && !configuredSeedPassword) {
            throw new Error("SEED_ADMIN_PASSWORD must be set when creating the production owner")
        }
        const seedPassword = configuredSeedPassword || generatedPassword
        await prisma.user.create({
            data: {
                username: seedUsername,
                passwordHash: await bcrypt.hash(seedPassword, 10),
                twoFactorEnabled: false,
                timerIdlePauseMinutes: 60,
            }
        })
        if (!configuredSeedPassword) {
            console.log(`Generated seed password for "${seedUsername}": ${seedPassword}`)
        }
    }

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
    await prisma.project.create({
        data: {
            siteId: site1.id,
            status: "Active",
            paymentStatus: "Paid",
            currentFee: 1000,
            services: { connect: [{ id: gtmService.id }] }
        }
    })

    await prisma.project.create({
        data: {
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
