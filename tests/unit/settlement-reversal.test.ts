import { describe, expect, it } from "vitest"
import {
    isProjectStillInSettlementState,
    parseSettlementAuditDetails,
    parseVoidedSettlementId,
} from "@/lib/payments/settlement-audit"

describe("payment settlement reversal", () => {
    it("parses and deduplicates the project snapshot", () => {
        const parsed = parseSettlementAuditDetails(JSON.stringify({
            partnerId: "partner-1",
            projects: [
                { id: "project-1", fee: 100 },
                { id: "project-1", fee: 100 },
                { id: "project-2", fee: 200 },
            ],
        }))

        expect(parsed?.projects.map((project) => project.id)).toEqual(["project-1", "project-2"])
    })

    it("matches only the exact state created by a new settlement", () => {
        const settlement = {
            createdAt: "2026-08-12T10:00:01.000Z",
            settledAt: "2026-08-12T10:00:00.000Z",
        }

        expect(isProjectStillInSettlementState({
            paymentStatus: "Paid",
            paidAt: "2026-08-12T10:00:00.000Z",
        }, settlement)).toBe(true)
        expect(isProjectStillInSettlementState({
            paymentStatus: "Paid",
            paidAt: "2026-08-12T10:05:00.000Z",
        }, settlement)).toBe(false)
    })

    it("supports legacy settlements only inside the audit-write window", () => {
        const settlement = { createdAt: "2026-08-12T10:00:30.000Z" }

        expect(isProjectStillInSettlementState({
            paymentStatus: "Paid",
            paidAt: "2026-08-12T10:00:00.000Z",
        }, settlement)).toBe(true)
        expect(isProjectStillInSettlementState({
            paymentStatus: "Paid",
            paidAt: "2026-08-12T09:50:00.000Z",
        }, settlement)).toBe(false)
        expect(isProjectStillInSettlementState({
            paymentStatus: "Unpaid",
            paidAt: null,
        }, settlement)).toBe(false)
    })

    it("links a void record to its original settlement", () => {
        expect(parseVoidedSettlementId(JSON.stringify({ auditLogId: "settlement-1" }))).toBe("settlement-1")
        expect(parseVoidedSettlementId("invalid")).toBeNull()
    })
})
