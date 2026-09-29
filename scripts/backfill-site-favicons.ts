import prisma from "../lib/prisma"
import { resolveDomainFaviconImage } from "../lib/favicon"

const REFRESH_ALL = process.argv.includes("--all")
const CONCURRENCY = 3

async function refreshSite(site: { id: string; domainName: string }) {
    try {
        const favicon = await resolveDomainFaviconImage(site.domainName)
        if (!favicon) {
            console.warn(`No favicon found for ${site.domainName}`)
            return false
        }

        await prisma.site.update({
            where: { id: site.id },
            data: {
                faviconUrl: favicon.sourceUrl,
                faviconData: favicon.data,
                faviconMimeType: favicon.mimeType,
                faviconHash: favicon.hash,
                faviconUpdatedAt: new Date(),
            },
        })
        console.info(`Stored favicon for ${site.domainName}`)
        return true
    } catch (error) {
        console.warn(`Failed to store favicon for ${site.domainName}:`, error instanceof Error ? error.message : error)
        return false
    }
}

async function main() {
    const sites = await prisma.site.findMany({
        where: REFRESH_ALL ? {} : { faviconData: null },
        select: { id: true, domainName: true },
        orderBy: { domainName: "asc" },
    })
    let stored = 0

    for (let index = 0; index < sites.length; index += CONCURRENCY) {
        const results = await Promise.all(sites.slice(index, index + CONCURRENCY).map(refreshSite))
        stored += results.filter(Boolean).length
    }

    console.info(`Stored ${stored} of ${sites.length} favicon${sites.length === 1 ? "" : "s"}.`)
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
