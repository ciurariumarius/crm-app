export type LmsDataSection = "catalog" | "imports" | "logs"

export function resolveLmsDataSection(value: string | null | undefined): LmsDataSection {
  if (value === "imports" || value === "logs") return value
  return "catalog"
}
