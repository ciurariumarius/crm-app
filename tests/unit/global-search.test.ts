import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMocks = vi.hoisted(() => ({
    projectFindMany: vi.fn(),
    taskFindMany: vi.fn(),
    partnerFindMany: vi.fn(),
    noteFindMany: vi.fn(),
    siteFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
    default: {
        project: { findMany: prismaMocks.projectFindMany },
        task: { findMany: prismaMocks.taskFindMany },
        partner: { findMany: prismaMocks.partnerFindMany },
        note: { findMany: prismaMocks.noteFindMany },
        site: { findMany: prismaMocks.siteFindMany },
    },
}))

vi.mock("@/lib/auth", () => ({
    requireAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
}))

import { globalSearch } from "@/lib/actions/search"

describe("globalSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns empty arrays for short queries without querying db", async () => {
        const result = await globalSearch("a")
        expect(result).toEqual({
            projects: [],
            tasks: [],
            partners: [],
            notes: [],
            sites: [],
        })
        expect(prismaMocks.projectFindMany).not.toHaveBeenCalled()
    })

    it("queries projects, tasks, partners, notes, and sites in parallel", async () => {
        prismaMocks.projectFindMany.mockResolvedValueOnce([
            {
                id: "p1",
                name: "Pixelist Brand Redesign",
                status: "Active",
                paymentStatus: "Paid",
                createdAt: new Date(),
                site: { domainName: "pixelist.ro", partner: { id: "pt1", name: "Marius" } },
                services: [{ serviceName: "PPC", isRecurring: true }],
            },
        ])
        prismaMocks.taskFindMany.mockResolvedValueOnce([
            {
                id: "t1",
                name: "Fix navigation header",
                status: "Active",
                urgency: "Urgent",
                project: {
                    id: "p1",
                    name: "Pixelist Brand Redesign",
                    site: { domainName: "pixelist.ro", partner: { id: "pt1", name: "Marius" } },
                },
            },
        ])
        prismaMocks.partnerFindMany.mockResolvedValueOnce([
            {
                id: "pt1",
                name: "Marius Limitless",
                businessName: "Pixelist SRL",
                emailPrimary: "marius@pixelist.ro",
            },
        ])
        prismaMocks.noteFindMany.mockResolvedValueOnce([
            {
                id: "n1",
                title: "Pixelist Marketing Strategy",
                contentText: "Pixelist guidelines for Google Ads and conversion tracking setup.",
                updatedAt: new Date("2026-08-20T10:00:00.000Z"),
                folder: { name: "Marketing" },
            },
        ])
        prismaMocks.siteFindMany.mockResolvedValueOnce([
            {
                id: "s1",
                domainName: "pixelist.ro",
                partner: { name: "Marius" },
            },
        ])

        const result = await globalSearch("pixelist")

        expect(result.projects).toHaveLength(1)
        expect(result.projects[0].name).toBe("Pixelist Brand Redesign")

        expect(result.tasks).toHaveLength(1)
        expect(result.tasks[0].name).toBe("Fix navigation header")

        expect(result.partners).toHaveLength(1)
        expect(result.partners[0].name).toBe("Marius Limitless")

        expect(result.notes).toHaveLength(1)
        expect(result.notes[0].title).toBe("Pixelist Marketing Strategy")
        expect(result.notes[0].folderName).toBe("Marketing")
        expect(result.notes[0].snippet).toContain("Pixelist")

        expect(result.sites).toHaveLength(1)
        expect(result.sites[0].domainName).toBe("pixelist.ro")
    })
})
