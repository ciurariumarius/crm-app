import { PrismaClient } from "@prisma/client"
import fs from "fs"
import { parse } from "csv-parse/sync"
import path from "path"

const prisma = new PrismaClient()
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

const CSV_PATH = path.join(process.cwd(), "temp_imports", "projects.csv")

interface NotionRow {
    "Project Name"?: string
    "Active Tasks"?: string
    "Amount"?: string
    "Client"?: string
    "Date"?: string
    "Details"?: string
    "Docs"?: string
    "Payment"?: string
    "Service"?: string
    "Status"?: string
    "Subscription"?: string
    "Tasks"?: string
    "Time (minutes)"?: string
}

async function importNotionProjects() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV not found at: ${CSV_PATH}`)
        return
    }

    console.log("🚀 Starting Advanced Import...")
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8")
    const records: NotionRow[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    })

    console.log(`📊 Processing ${records.length} records...`)

    await prisma.tenant.upsert({
        where: { id: DEFAULT_TENANT_ID },
        update: { name: "Default Tenant" },
        create: { id: DEFAULT_TENANT_ID, name: "Default Tenant" },
    })

    for (const row of records) {
        const projectName = row["Project Name"] || "Unnamed Project"
        try {
            const clientRaw = row["Client"] || ""
            const amountStr = row["Amount"]?.toString() || "0"
            const amount = parseFloat(amountStr.replace(/[^0-9.]/g, "") || "0")
            const serviceRaw = row["Service"] || "General Support"
            const isSubscription = row["Subscription"] === "Yes" || row["Subscription"] === "true"
            const status = mapStatus(row["Status"] || "")
            const paymentStatus = mapPaymentStatus(row["Payment"] || "")
            const taskList = row["Tasks"] || ""
            const timeMinutesStr = row["Time (minutes)"]?.toString() || "0"
            const timeMinutes = parseInt(timeMinutesStr || "0")
            const createdAt = row["Date"] ? new Date(row["Date"]) : new Date()

            // 1. Partner Detection
            const clientMatch = clientRaw.match(/([^\(]+)\s*\((https:\/\/www\.notion\.so\/[^\)]+)\)/)
            const partnerName = clientMatch ? clientMatch[1].trim() : (clientRaw.trim() || "Unspecified Client")
            const cleanPartnerName = partnerName.replace(/^Client\s+/i, "")

            // 2. Domain Normalization
            let domainName = projectName.toLowerCase()
            if (!domainName.includes(".") || domainName.includes(" ")) {
                domainName = `${cleanPartnerName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${projectName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.notion.internal`
            }

            // 3. Sync Partner
            const partner = await prisma.partner.upsert({
                where: { tenantId_name: { tenantId: DEFAULT_TENANT_ID, name: cleanPartnerName } },
                update: {},
                create: { tenantId: DEFAULT_TENANT_ID, name: cleanPartnerName, internalNotes: "Notion Import" }
            })

            // 4. Sync Site
            const site = await prisma.site.upsert({
                where: { tenantId_domainName: { tenantId: DEFAULT_TENANT_ID, domainName: domainName } },
                update: { partnerId: partner.id },
                create: { tenantId: DEFAULT_TENANT_ID, partnerId: partner.id, domainName: domainName }
            })

            // 5. Parse & Sync Services
            // Notion often exports multi-select values as comma-separated strings with URLs
            const serviceNames = serviceRaw.split(/,|\n/).map(s => {
                // Remove Notion link formatting: "Service Name (https://...)" -> "Service Name"
                return s.replace(/\s*\(https:\/\/www\.notion\.so\/[^\)]+\)/g, "").trim()
            }).filter(Boolean)

            if (serviceNames.length === 0) serviceNames.push("General Support")

            const serviceIds: string[] = []
            for (const sName of serviceNames) {
                const s = await prisma.service.upsert({
                    where: { tenantId_serviceName: { tenantId: DEFAULT_TENANT_ID, serviceName: sName } },
                    update: {},
                    create: {
                        tenantId: DEFAULT_TENANT_ID,
                        serviceName: sName,
                        isRecurring: isSubscription,
                        standardTasks: "[]"
                    }
                })
                serviceIds.push(s.id)
            }

            // 6. Create Project
            const project = await prisma.project.create({
                data: {
                    tenantId: DEFAULT_TENANT_ID,
                    siteId: site.id,
                    status: status,
                    paymentStatus: paymentStatus,
                    currentFee: amount,
                    createdAt: createdAt,
                    services: { connect: serviceIds.map(id => ({ id })) }
                }
            })

            // 7. Add Tasks
            if (taskList) {
                const tasks = taskList.split(/,|\n/).map((t: string) => t.trim()).filter(Boolean)
                for (const tName of tasks) {
                    await prisma.task.create({
                        data: { tenantId: DEFAULT_TENANT_ID, projectId: project.id, name: tName, status: "Completed" }
                    })
                }
            }

            // 8. Add Time Logs
            if (timeMinutes > 0) {
                await prisma.timeLog.create({
                    data: {
                        tenantId: DEFAULT_TENANT_ID,
                        projectId: project.id,
                        description: `Imported from Notion: ${projectName}`,
                        startTime: createdAt,
                        durationSeconds: timeMinutes * 60
                    }
                })
            }

            console.log(`✅ OK: ${cleanPartnerName} -> ${projectName} (${serviceNames.join(", ")})`)

        } catch (error) {
            console.error(`❌ FAILED: ${projectName}`, error)
        }
    }

    console.log("\n✨ Master Sync Complete.")
}

function mapStatus(s: string) {
    s = s.toLowerCase()
    if (s.includes("active") || s.includes("doing")) return "Active"
    if (s.includes("pause")) return "Paused"
    if (s.includes("done") || s.includes("complete")) return "Completed"
    return "Active"
}

function mapPaymentStatus(p: string) {
    return p.toLowerCase().includes("paid") ? "Paid" : "Unpaid"
}

importNotionProjects().finally(() => prisma.$disconnect())
