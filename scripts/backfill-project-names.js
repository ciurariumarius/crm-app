/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

function formatProjectServiceName(service) {
    const baseName = (service?.serviceName || "").trim()
    if (!baseName) return ""

    return baseName
}

function formatProjectServiceList(services, fallback = "No Service") {
    if (!services || services.length === 0) return fallback

    const seen = new Set()
    const normalized = services
        .map((service) => formatProjectServiceName(service))
        .filter(Boolean)
        .filter((serviceName) => {
            const key = serviceName.toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

    return normalized.length > 0 ? normalized.join(", ") : fallback
}

function formatProjectName(project) {
    const domain = (project?.site?.domainName || project?.siteName || "").trim()
    const serviceNames = formatProjectServiceList(project?.services, "")
    const hasServiceNames = serviceNames.length > 0
    const leftPart = domain || project?.name || "Unknown Site"

    const isRecurring = (project?.services || []).some((service) => Boolean(service?.isRecurring))
    const createdDate = project?.createdAt ? new Date(project.createdAt) : null
    const hasValidCreatedAt = createdDate && !Number.isNaN(createdDate.getTime())
    const monthYear = hasValidCreatedAt
        ? createdDate.toLocaleString("en-US", { month: "long", year: "numeric" })
        : null

    const baseLabel = hasServiceNames ? `${leftPart} - ${serviceNames}` : leftPart

    if (isRecurring && monthYear) {
        return `${baseLabel} - ${monthYear}`
    }

    return baseLabel
}

async function backfillProjectNames() {
    const isDryRun = process.argv.includes("--dry-run")
    const startedAt = Date.now()

    const projects = await prisma.project.findMany({
        select: {
            id: true,
            name: true,
            createdAt: true,
            site: {
                select: { domainName: true },
            },
            services: {
                select: {
                    serviceName: true,
                    isRecurring: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    })

    let unchanged = 0
    let updated = 0
    const preview = []

    for (const project of projects) {
        const nextName = formatProjectName({
            site: project.site,
            services: project.services,
            createdAt: project.createdAt,
            name: project.name,
        })

        const currentName = project.name || null
        if (currentName === nextName) {
            unchanged += 1
            continue
        }

        if (preview.length < 20) {
            preview.push({
                id: project.id,
                from: currentName,
                to: nextName,
            })
        }

        if (!isDryRun) {
            // Raw SQL keeps existing updatedAt values untouched.
            await prisma.$executeRaw`
                UPDATE projects
                SET name = ${nextName}
                WHERE id = ${project.id}
            `
        }

        updated += 1
    }

    const elapsedMs = Date.now() - startedAt
    const modeLabel = isDryRun ? "DRY RUN" : "APPLY"

    console.log(`[backfill-project-names] ${modeLabel} complete`)
    console.log(`[backfill-project-names] scanned=${projects.length} updated=${updated} unchanged=${unchanged} durationMs=${elapsedMs}`)

    if (preview.length > 0) {
        console.log("[backfill-project-names] sample changes:")
        preview.forEach((item, index) => {
            console.log(`${index + 1}. projectId=${item.id}`)
            console.log(`   from: ${item.from ?? "NULL"}`)
            console.log(`   to:   ${item.to}`)
        })
    }
}

backfillProjectNames()
    .catch((error) => {
        console.error("[backfill-project-names] failed", error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
