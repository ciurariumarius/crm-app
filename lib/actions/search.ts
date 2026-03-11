"use server"

import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"

export async function globalSearch(query: string) {
    if (!query || query.length < 2) return { projects: [], tasks: [], partners: [] }

    const { tenantId } = await requireTenantContext()
    const q = query.trim()

    try {
        const [projects, tasks, partners] = await Promise.all([
            prisma.project.findMany({
                where: {
                    tenantId,
                    OR: [
                        { site: { domainName: { contains: q } } },
                        { site: { partner: { name: { contains: q } } } }
                    ],
                },
                include: {
                    site: {
                        include: { partner: true }
                    },
                    services: true,
                    timeLogs: true,
                    tasks: { include: { timeLogs: true } },
                    _count: { select: { tasks: true } }
                },
                take: 5
            }),
            prisma.task.findMany({
                where: {
                    tenantId,
                    name: { contains: q }
                },
                include: {
                    project: {
                        include: {
                            site: true
                        }
                    }
                },
                take: 5
            }),
            prisma.partner.findMany({
                where: {
                    tenantId,
                    OR: [
                        { name: { contains: q } },
                        { businessName: { contains: q } }
                    ]
                },
                take: 5
            })
        ])

        return { projects, tasks, partners }
    } catch (error) {
        console.error("[search] global search failed", error)
        return { projects: [], tasks: [], partners: [] }
    }
}
