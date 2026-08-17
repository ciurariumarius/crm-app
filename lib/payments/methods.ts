export const DEFAULT_PAYMENT_METHODS = ["Revolut", "BT Pay", "Cash"] as const

export function normalizePaymentMethod(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, 64)
}

export function mergePaymentMethods(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  return [...DEFAULT_PAYMENT_METHODS, ...values]
    .map(normalizePaymentMethod)
    .filter((value) => {
      const key = value.toLocaleLowerCase("ro-RO")
      if (!value || seen.has(key)) return false
      seen.add(key)
      return true
    })
}
