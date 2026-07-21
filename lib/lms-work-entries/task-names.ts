export const LMS_WORK_TASK_NAMES_WITH_TRAILING_SPACE = [
  "Debriefing client - ca urmare a auditului ",
  "Followup la tracking - ca urmare a debriefing-ului ",
  "Meeting / videocall client ",
  "Meeting / videocall intern ",
  "Setare tracking - alte sisteme de advertising ",
] as const

function normalizeTaskNameForLookup(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO")
}

const EXACT_TASK_NAMES_BY_NORMALIZED_NAME = new Map(
  LMS_WORK_TASK_NAMES_WITH_TRAILING_SPACE.map((name) => [normalizeTaskNameForLookup(name), name])
)

/**
 * CRM matches task labels exactly. Known source labels retain their intentional
 * trailing space; other catalog labels are cleaned for safe manual entry.
 */
export function canonicalizeLmsWorkTaskName(value: string) {
  const compactName = value.normalize("NFKC").trim().replace(/\s+/g, " ")
  return EXACT_TASK_NAMES_BY_NORMALIZED_NAME.get(normalizeTaskNameForLookup(compactName)) ?? compactName
}
