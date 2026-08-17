import { describe, expect, it } from "vitest"
import {
    formatMonthKeyLabel,
    getDefaultRecurringMonth,
    getMinimumRecurringMonth,
    parseMonthKey,
} from "@/lib/projects/recurring-month"

describe("recurring project month selection", () => {
    it("starts after the source project month", () => {
        expect(getMinimumRecurringMonth(new Date(2026, 3, 15, 12))).toBe("2026-05")
        expect(getMinimumRecurringMonth(new Date(2026, 11, 15, 12))).toBe("2027-01")
    })

    it("defaults to this month when available", () => {
        expect(
            getDefaultRecurringMonth(
                new Date(2026, 3, 15, 12),
                new Date(2026, 7, 17, 12)
            )
        ).toBe("2026-08")
    })

    it("defaults to the first valid month for a future source", () => {
        expect(
            getDefaultRecurringMonth(
                new Date(2026, 10, 15, 12),
                new Date(2026, 7, 17, 12)
            )
        ).toBe("2026-12")
    })

    it("parses and formats month keys", () => {
        expect(parseMonthKey("2026-08")).toEqual({ year: 2026, month: 8 })
        expect(parseMonthKey("2026-13")).toBeNull()
        expect(formatMonthKeyLabel("2026-08")).toBe("August 2026")
    })
})
