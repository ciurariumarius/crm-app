import { PrismaClient } from "@prisma/client"
import path from "path"

const prisma = new PrismaClient()

async function movePartnersToDOT() {
    console.log("🔄 Starting partner migration to DOT...")

    // Partners to move
    const partnerNames = ["optiktataru.ro", "tacoloco.ro", "cosmeticahoteliera.ro"]

    // Find DOT partner
    const dotPartner = await prisma.partner.findUnique({
        where: { name: "DOT" }
    })

    if (!dotPartner) {
        console.error("❌ DOT partner not found!")
        return
    }

    console.log(`✅ Found DOT partner: ${dotPartner.id}`)

    for (const partnerName of partnerNames) {
        try {
            // Find the partner
            const partner = await prisma.partner.findUnique({
                where: { name: partnerName },
                include: { sites: true }
            })

            if (!partner) {
                console.log(`⚠️  Partner "${partnerName}" not found, skipping...`)
                continue
            }

            console.log(`\n📦 Processing "${partnerName}"...`)
            console.log(`   Found ${partner.sites.length} site(s)`)

            // Update all sites to point to DOT
            const updateResult = await prisma.site.updateMany({
                where: { partnerId: partner.id },
                data: { partnerId: dotPartner.id }
            })

            console.log(`   ✅ Moved ${updateResult.count} site(s) to DOT`)

            // Delete the old partner (cascade will handle cleanup if needed)
            await prisma.partner.delete({
                where: { id: partner.id }
            })

            console.log(`   ✅ Deleted old partner "${partnerName}"`)

        } catch (error) {
            console.error(`❌ Error processing "${partnerName}":`, error)
        }
    }

    console.log("\n✨ Migration complete!")
}

movePartnersToDOT().finally(() => prisma.$disconnect())
