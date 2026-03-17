import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function cleanupNotionDomains() {
    console.log("🧹 Cleaning up Notion import domain names...")

    // Find all sites with .notion.internal domains
    const notionSites = await prisma.site.findMany({
        where: {
            domainName: {
                contains: ".notion.internal"
            }
        },
        include: {
            partner: true,
            projects: {
                include: {
                    services: true
                }
            }
        }
    })

    console.log(`📊 Found ${notionSites.length} sites to clean up\n`)

    const usedDomains = new Set<string>()
    let counter = 1

    for (const site of notionSites) {
        try {
            // Get the primary service from the first project
            const primaryService = site.projects[0]?.services[0]?.serviceName || "general"

            // Create a clean, short domain name
            const partnerSlug = site.partner.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .substring(0, 8)

            const serviceSlug = primaryService
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .substring(0, 12)

            // Base domain
            let newDomain = `${partnerSlug}.${serviceSlug}.import`

            // If domain already used, add a counter
            if (usedDomains.has(newDomain)) {
                newDomain = `${partnerSlug}.${serviceSlug}${counter}.import`
                counter++
            }

            usedDomains.add(newDomain)

            // Update the site
            await prisma.site.update({
                where: { id: site.id },
                data: { domainName: newDomain }
            })

            console.log(`✅ ${site.partner.name}: ${site.domainName.substring(0, 40)}... → ${newDomain}`)

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error"
            console.error(`❌ Error updating site ${site.id}:`, message)
        }
    }

    console.log("\n✨ Cleanup complete!")

    // Show summary
    const remaining = await prisma.site.count({
        where: { domainName: { contains: ".notion.internal" } }
    })
    console.log(`\n📊 Remaining .notion.internal domains: ${remaining}`)
}

cleanupNotionDomains().finally(() => prisma.$disconnect())
