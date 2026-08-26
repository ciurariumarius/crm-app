"use server"

import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

const MIN_QUERY_LENGTH = 2
const CANDIDATE_LIMIT = 24
const RESULT_LIMIT = 5

export type GlobalSearchResultProject = {
    id: string
    name?: string | null
    status?: string | null
    paymentStatus?: string | null
    createdAt?: string | Date | null
    site?: {
        domainName?: string | null
        partner?: {
            id?: string
            name?: string | null
        } | null
    } | null
    services?: Array<{
        serviceName?: string | null
        isRecurring?: boolean | null
    }> | null
}

export type GlobalSearchResultTask = {
    id: string
    name: string
    status?: string | null
    urgency?: string | null
    project?: {
        id: string
        name?: string | null
        site?: {
            domainName?: string | null
            partner?: {
                id?: string
                name?: string | null
            } | null
        } | null
    } | null
}

export type GlobalSearchResultPartner = {
    id: string
    name: string
    businessName?: string | null
    emailPrimary?: string | null
}

export type GlobalSearchResultNote = {
    id: string
    title: string
    snippet?: string | null
    folderName?: string | null
    updatedAt: string | Date
}

export type GlobalSearchResultSite = {
    id: string
    domainName: string
    partnerName?: string | null
}

export type GlobalSearchResults = {
    projects: GlobalSearchResultProject[]
    tasks: GlobalSearchResultTask[]
    partners: GlobalSearchResultPartner[]
    notes: GlobalSearchResultNote[]
    sites: GlobalSearchResultSite[]
}

function normalizeSearchValue(value: string | null | undefined) {
    return (value || "").trim().toLowerCase()
}

function scoreField(rawValue: string | null | undefined, query: string) {
    const value = normalizeSearchValue(rawValue)
    if (!value) return 0
    if (value === query) return 4
    if (value.startsWith(query)) return 3
    if (value.includes(` ${query}`)) return 2
    if (value.includes(query)) return 1
    return 0
}

function rankItems<T>(items: T[], input: {
    query: string
    fields: (item: T) => Array<string | null | undefined>
    tieBreaker: (item: T) => string
    limit?: number
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

    return ranked.map((entry) => entry.item).slice(0, input.limit ?? RESULT_LIMIT)
}

function extractSnippet(text: string | null | undefined, query: string): string {
    if (!text) return ""
    const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (!clean) return ""
    const lower = clean.toLowerCase()
    const idx = lower.indexOf(query.toLowerCase())
    if (idx === -1) {
        return clean.slice(0, 90) + (clean.length > 90 ? "…" : "")
    }
    const start = Math.max(0, idx - 25)
    const end = Math.min(clean.length, idx + query.length + 50)
    const prefix = start > 0 ? "…" : ""
    const suffix = end < clean.length ? "…" : ""
    return `${prefix}${clean.slice(start, end).trim()}${suffix}`
}

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
    const emptyResult: GlobalSearchResults = {
        projects: [],
        tasks: [],
        partners: [],
        notes: [],
        sites: [],
    }

    if (!query || query.trim().length < MIN_QUERY_LENGTH) return emptyResult

    await requireAuth()
    const q = query.trim()
    const normalizedQuery = normalizeSearchValue(q)

    try {
        const [projectCandidates, taskCandidates, partnerCandidates, noteCandidates, siteCandidates] = await Promise.all([
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
                    status: true,
                    paymentStatus: true,
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
                    status: true,
                    urgency: true,
                    project: {
                        select: {
                            id: true,
                            name: true,
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
                        },
                    },
                },
                take: CANDIDATE_LIMIT,
            }),
            prisma.partner.findMany({
                where: {
                    OR: [
                        { name: { contains: q } },
                        { businessName: { contains: q } },
                        { emailPrimary: { contains: q } },
                        { phone: { contains: q } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    businessName: true,
                    emailPrimary: true,
                },
                take: CANDIDATE_LIMIT,
            }),
            prisma.note.findMany({
                where: {
                    OR: [
                        { title: { contains: q } },
                        { contentText: { contains: q } },
                        { folder: { name: { contains: q } } },
                    ],
                },
                select: {
                    id: true,
                    title: true,
                    contentText: true,
                    updatedAt: true,
                    folder: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: { updatedAt: "desc" },
                take: CANDIDATE_LIMIT,
            }),
            prisma.site.findMany({
                where: {
                    OR: [
                        { domainName: { contains: q } },
                        { name: { contains: q } },
                        { partner: { name: { contains: q } } },
                    ],
                },
                select: {
                    id: true,
                    domainName: true,
                    partner: {
                        select: {
                            name: true,
                        },
                    },
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
                ...((project.services ?? []).map((service) => service.serviceName)),
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
            ],
            tieBreaker: (task) => task.name || task.project?.name || task.id,
        })

        const partners = rankItems(partnerCandidates, {
            query: normalizedQuery,
            fields: (partner) => [partner.name, partner.businessName, partner.emailPrimary],
            tieBreaker: (partner) => partner.name || partner.businessName || partner.id,
        })

        const notes: GlobalSearchResultNote[] = rankItems(noteCandidates, {
            query: normalizedQuery,
            fields: (note) => [note.title, note.folder?.name, note.contentText],
            tieBreaker: (note) => note.title || note.id,
        }).map((note) => ({
            id: note.id,
            title: note.title || "Untitled",
            snippet: extractSnippet(note.contentText, q),
            folderName: note.folder?.name ?? null,
            updatedAt: note.updatedAt,
        }))

        const sites: GlobalSearchResultSite[] = rankItems(siteCandidates, {
            query: normalizedQuery,
            fields: (site) => [site.domainName, site.partner?.name],
            tieBreaker: (site) => site.domainName || site.id,
        }).map((site) => ({
            id: site.id,
            domainName: site.domainName,
            partnerName: site.partner?.name ?? null,
        }))

        return { projects, tasks, partners, notes, sites }
    } catch (error) {
        console.error("[search] global search failed", error)
        return emptyResult
    }
}

