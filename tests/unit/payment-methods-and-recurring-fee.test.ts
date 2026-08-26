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

describe("unpaid projects with zero sum", () => {
  it("excludes zero-fee unpaid projects from partner balances", () => {
    const mockProjects = [
      { id: "p1", paymentStatus: "Unpaid", currentFee: 500, site: { partnerId: "partner-1" } },
      { id: "p2", paymentStatus: "Unpaid", currentFee: 0, site: { partnerId: "partner-1" } },
      { id: "p3", paymentStatus: "Unpaid", currentFee: 0, site: { partnerId: "partner-2" } },
      { id: "p4", paymentStatus: "Paid", currentFee: 300, site: { partnerId: "partner-3" } },
    ]

    const unpaidMap = new Map<string, { id: string; total: number; count: number }>()
    for (const project of mockProjects) {
      if (project.paymentStatus !== "Unpaid") continue
      const amount = Number(project.currentFee || 0)
      if (amount <= 0) continue
      const existing = unpaidMap.get(project.site.partnerId) || { id: project.site.partnerId, total: 0, count: 0 }
      existing.total += amount
      existing.count += 1
      unpaidMap.set(project.site.partnerId, existing)
    }

    const unpaidPartners = Array.from(unpaidMap.values()).filter((p) => p.total > 0 && p.count > 0)
    expect(unpaidPartners).toHaveLength(1)
    expect(unpaidPartners[0]).toEqual({ id: "partner-1", total: 500, count: 1 })
  })
})
