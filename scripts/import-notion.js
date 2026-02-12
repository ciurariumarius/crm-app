const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const { parse } = require("csv-parse/sync")
const path = require("path")

async function run() {
    const prisma = new PrismaClient()

    const CSV_PATH = path.join(process.cwd(), "temp_imports", "projects.csv")

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV not found at: ${CSV_PATH}`)
        return
    }

    console.log("🚀 Starting Import...")
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8")
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    })

    for (const row of records) {
        try {
            const projectName = row["Project Name"] || "Unnamed"
            const clientRaw = row["Client"] || ""

            const clientMatch = clientRaw.match(/([^\(]+)\s*\((https:\/\/www\.notion\.so\/[^\)]+)\)/)
            const partnerName = clientMatch ? clientMatch[1].trim() : clientRaw.trim()
            const cleanPartnerName = partnerName.replace(/^Client\s+/i, "") || "Unspecified"

            const partner = await prisma.partner.upsert({
                where: { name: cleanPartnerName },
                update: {},
                create: { name: cleanPartnerName }
            })

            const domainBase = cleanPartnerName.toLowerCase().replace(/[^a-z0-9]/g, "-")
            const domainName = `${domainBase}-${Math.random().toString(36).substring(7)}.asset.com`

            const site = await prisma.site.create({
                data: {
                    partnerId: partner.id,
                    domainName: domainName
                }
            })

            const serviceName = row["Service"] || "General"
            const service = await prisma.service.upsert({
                where: { serviceName: serviceName },
                update: {},
                create: {
                    serviceName: serviceName,
                    standardTasks: "[]"
                }
            })

            await prisma.project.create({
                data: {
                    siteId: site.id,
                    status: mapStatus(row["Status"] || ""),
                    paymentStatus: mapPaymentStatus(row["Payment"] || ""),
                    currentFee: parseFloat(row["Amount"]?.toString().replace(/[^0-9.]/g, "") || "0"),
                    services: { connect: { id: service.id } }
                }
            })

            console.log(`✅ OK: ${projectName}`)
        } catch (e) {
            console.error(`❌ Fail: ${row["Project Name"]}`, e)
        }
    }
    await prisma.$disconnect();
}

function mapStatus(s) {
    s = s.toLowerCase()
    if (s.includes("active")) return "Active"
    if (s.includes("pause")) return "Paused"
    if (s.includes("done")) return "Completed"
    return "Active"
}

function mapPaymentStatus(p) {
    return p.toLowerCase().includes("paid") ? "Paid" : "Unpaid"
}

run().catch(console.error);
