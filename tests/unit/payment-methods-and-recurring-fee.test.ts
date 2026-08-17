import { describe, expect, it } from "vitest"
import { mergePaymentMethods, normalizePaymentMethod } from "@/lib/payments/methods"
import { resolveRecurringRolloverFee } from "@/lib/projects/recurring-fee"

describe("payment methods", () => {
  it("keeps defaults and adds normalized custom methods once", () => {
    expect(mergePaymentMethods([" Bank transfer ", "revolut", "Bank   transfer"])).toEqual([
      "Revolut",
      "BT Pay",
      "Cash",
      "Bank transfer",
    ])
    expect(normalizePaymentMethod("  Bank   transfer  ")).toBe("Bank transfer")
  })
})

describe("recurring monthly fee", () => {
  it("rolls forward the base fee instead of a one-month override", () => {
    expect(resolveRecurringRolloverFee(500, 725)).toBe(500)
  })

  it("falls back to the current fee for pre-migration records", () => {
    expect(resolveRecurringRolloverFee(null, 725)).toBe(725)
  })
})
