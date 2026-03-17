/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const { parse } = require("csv-parse/sync")
const path = require("path")

async function run() {
    const prisma = new PrismaClient()
    const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

    await prisma.tenant.upsert({
        where: { id: DEFAULT_TENANT_ID },
        update: { name: "Default Tenant" },
        create: { id: DEFAULT_TENANT_ID, name: "Default Tenant" },
    })

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
                where: { tenantId_name: { tenantId: DEFAULT_TENANT_ID, name: cleanPartnerName } },
                update: {},
                create: { tenantId: DEFAULT_TENANT_ID, name: cleanPartnerName }
            })

            const domainBase = cleanPartnerName.toLowerCase().replace(/[^a-z0-9]/g, "-")
            const domainName = `${domainBase}-${Math.random().toString(36).substring(7)}.asset.com`

            const site = await prisma.site.create({
                data: {
                    partnerId: partner.id,
                    tenantId: DEFAULT_TENANT_ID,
                    domainName: domainName
                }
            })

            const serviceName = row["Service"] || "General"
            const service = await prisma.service.upsert({
                where: { tenantId_serviceName: { tenantId: DEFAULT_TENANT_ID, serviceName: serviceName } },
                update: {},
                create: {
                    tenantId: DEFAULT_TENANT_ID,
                    serviceName: serviceName,
                    standardTasks: "[]"
                }
            })

            await prisma.project.create({
                data: {
                    tenantId: DEFAULT_TENANT_ID,
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
