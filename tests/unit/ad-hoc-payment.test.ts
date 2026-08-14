import { describe, expect, it } from "vitest"
import {
    getLegacyAdHocPaymentDomain,
    getPartnerAdHocPaymentDomain,
} from "@/lib/payments/ad-hoc-payment"

describe("partner ad-hoc payment site", () => {
    it("keeps the legacy domain available for an existing owner", () => {
        expect(getLegacyAdHocPaymentDomain()).toBe("ad-hoc-payments.local")
    })

    it("creates a stable globally unique domain for each partner", () => {
        const firstPartner = "11111111-1111-4111-8111-111111111111"
        const secondPartner = "22222222-2222-4222-8222-222222222222"

        expect(getPartnerAdHocPaymentDomain(firstPartner)).toBe(
            "ad-hoc-payments-11111111-1111-4111-8111-111111111111.local"
        )
        expect(getPartnerAdHocPaymentDomain(firstPartner)).not.toBe(
            getPartnerAdHocPaymentDomain(secondPartner)
        )
    })

    it("rejects malformed partner IDs", () => {
        expect(() => getPartnerAdHocPaymentDomain("partner-1")).toThrow(
            "A valid partner ID is required"
        )
    })
})
