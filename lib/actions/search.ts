"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

const MIN_QUERY_LENGTH = 2
const CANDIDATE_LIMIT = 24
const RESULT_LIMIT = 5

function normalizeSearchValue(value: string | null | undefined) {
    return (value || "").trim().toLowerCase()
}

function scoreField(rawValue: string | null | undefined, query: string) {
    const value = normalizeSearchValue(rawValue)
    if (!value) return 0
    if (value === query) return 3
    if (value.startsWith(query)) return 2
    if (value.includes(query)) return 1
    return 0
}

function rankItems<T>(items: T[], input: {
    query: string
    fields: (item: T) => Array<string | null | undefined>
    tieBreaker: (item: T) => string
}) {
    const ranked = items
        .map((item) => {
            const bestScore = input.fields(item).reduce((best, field) => Math.max(best, scoreField(field, input.query)), 0)
            return {
                item,
                score: bestScore,
                tie: normalizeSearchValue(input.tieBreaker(item)),
            }
        })
        .filter((entry) => entry.score > 0)

    ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.tie !== b.tie) return a.tie.localeCompare(b.tie)
        return 0
    })

    return ranked.map((entry) => entry.item).slice(0, RESULT_LIMIT)
}

export async function globalSearch(query: string) {
    if (!query || query.trim().length < MIN_QUERY_LENGTH) return { projects: [], tasks: [], partners: [] }

    await requireAuth()
    const q = query.trim()
    const normalizedQuery = normalizeSearchValue(q)

    try {
        const [projectCandidates, taskCandidates, partnerCandidates] = await Promise.all([
            prisma.project.findMany({
                where: {
                    OR: [
                        { name: { contains: q } },
                        { site: { domainName: { contains: q } } },
                        { site: { partner: { name: { contains: q } } } },
                        { services: { some: { serviceName: { contains: q } } } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    site: {
                        select: {
                            domainName: true,
                            partner: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    services: {
                        select: {
                            serviceName: true,
                            isRecurring: true,
                        },
                    },
                },
                take: CANDIDATE_LIMIT,
            }),
            prisma.task.findMany({
                where: {
                    OR: [
                        { name: { contains: q } },
                        { description: { contains: q } },
                        { project: { name: { contains: q } } },
                        { project: { site: { domainName: { contains: q } } } },
                        { project: { site: { partner: { name: { contains: q } } } } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    project: {
                        select: {
                            id: true,
                            name: true,
                            createdAt: true,
                            site: {
                                select: {
                                    domainName: true,
                                    partner: {
                                        select: {
                                            id: true,
                                            name: true,
                                        },
                                    },
                                },
                            },
                            services: {
                                select: {
                                    serviceName: true,
                                    isRecurring: true,
                                },
                            },
                        }
                    },
                },
                take: CANDIDATE_LIMIT,
            }),
            prisma.partner.findMany({
                where: {
                    OR: [
                        { name: { contains: q } },
                        { businessName: { contains: q } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    businessName: true,
                },
                take: CANDIDATE_LIMIT,
            }),
        ])

        const projects = rankItems(projectCandidates, {
            query: normalizedQuery,
            fields: (project) => [
                project.name,
                project.site?.domainName,
                project.site?.partner?.name,
                ...project.services.map((service) => service.serviceName),
            ],
            tieBreaker: (project) => project.name || project.site?.domainName || project.id,
        })

        const tasks = rankItems(taskCandidates, {
            query: normalizedQuery,
            fields: (task) => [
                task.name,
                task.project?.name,
                task.project?.site?.domainName,
                task.project?.site?.partner?.name,
                ...(task.project?.services.map((service) => service.serviceName) || []),
            ],
            tieBreaker: (task) => task.name || task.project?.name || task.id,
        })

        const partners = rankItems(partnerCandidates, {
            query: normalizedQuery,
            fields: (partner) => [partner.name, partner.businessName],
            tieBreaker: (partner) => partner.name || partner.businessName || partner.id,
        })

        return { projects, tasks, partners }
    } catch (error) {
        console.error("[search] global search failed", error)
        return { projects: [], tasks: [], partners: [] }
    }
}
