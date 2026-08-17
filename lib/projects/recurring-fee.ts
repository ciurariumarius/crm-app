export function resolveRecurringRolloverFee(
  recurringBaseFee: number | string | { toString(): string } | null | undefined,
  currentFee: number | string | { toString(): string } | null | undefined
) {
  const base = recurringBaseFee === null || recurringBaseFee === undefined
    ? Number(currentFee || 0)
    : Number(recurringBaseFee)
  return Number.isFinite(base) ? base : 0
}
