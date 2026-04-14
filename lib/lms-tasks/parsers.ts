import Papa from "papaparse"
import { parseDateLikeToIso } from "@/lib/lms-tasks/date-utils"
import type { ClientAllocation, ParseIssue, ParseResult, ServiceStatus, TaskLog } from "@/lib/lms-tasks/types"

type SheetRows = unknown[][]

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isCellEmpty(value: unknown) {
  return value == null || String(value).trim() === ""
}

function normalizeExcelCellValue(value: unknown): unknown {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)

  if (typeof value === "object") {
    const candidate = value as {
      text?: string
      result?: unknown
      richText?: Array<{ text?: string }>
      hyperlink?: string
    }

    if (typeof candidate.text === "string" && candidate.text.trim()) return candidate.text
    if (typeof candidate.hyperlink === "string" && candidate.hyperlink.trim()) return candidate.hyperlink
    if (candidate.result != null) return normalizeExcelCellValue(candidate.result)
    if (Array.isArray(candidate.richText)) {
      return candidate.richText.map((entry) => entry?.text || "").join("")
    }
  }

  return String(value)
}

async function readRowsFromFile(file: File): Promise<SheetRows> {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".txt")) {
    const delimiter = lowerName.endsWith(".tsv") ? "\t" : ","
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, {
      delimiter,
      skipEmptyLines: false,
      header: false,
    })
    return (parsed.data as unknown[]) as SheetRows
  }

  const ExcelJS = await import("exceljs")
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const rows: SheetRows = []
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    rows.push(values.map((value) => normalizeExcelCellValue(value)))
  })
  return rows
}

function findColumnIndexByTerms(headers: string[], terms: string[], mode: "partial" | "exact" = "partial") {
  const normalizedTerms = terms.map(normalizeText).filter(Boolean)
  let bestIndex = -1
  let bestScore = -1

  headers.forEach((header, index) => {
    for (const term of normalizedTerms) {
      if (mode === "exact") {
        if (header === term) return void (bestIndex = index, bestScore = Number.MAX_SAFE_INTEGER)
        continue
      }

      let score = -1
      if (header === term) score = 4
      else if (header.startsWith(`${term} `) || header.endsWith(` ${term}`) || header.includes(` ${term} `)) score = 3
      else if (header.includes(term)) score = 2

      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }
  })

  return bestIndex
}

function parseDurationToMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value))
  if (typeof value !== "string") return 0

  const trimmed = value.trim()
  if (!trimmed) return 0

  if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":").map(Number)
    if (Number.isFinite(h) && Number.isFinite(m)) return Math.max(0, h * 60 + m)
  }

  const hoursMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*h(?:ours?)?$/i)
  if (hoursMatch) {
    const hours = Number(hoursMatch[1].replace(",", "."))
    if (Number.isFinite(hours)) return Math.max(0, Math.round(hours * 60))
  }

  const minMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(m|min|minute|minutes)?$/i)
  if (minMatch) {
    const minutes = Number(minMatch[1].replace(",", "."))
    if (Number.isFinite(minutes)) return Math.max(0, Math.round(minutes))
  }

  return 0
}

function normalizeServiceStatus(value: unknown): ServiceStatus {
  const normalized = normalizeText(value)
  if (!normalized) return "-"
  if (normalized.includes("active") || normalized === "activ") return "Active"
  if (normalized.includes("inactive") || normalized.includes("inactiv")) return "Inactive"
  if (normalized.includes("stopped") || normalized.includes("stop") || normalized.includes("oprit")) return "Stopped"
  return "-"
}

function toStringSafe(value: unknown) {
  if (value == null) return ""
  return String(value).trim()
}

function getRowCell(row: unknown[], index: number) {
  if (index < 0) return null
  return row[index]
}

function isRowCompletelyEmpty(row: unknown[]) {
  return row.every((cell) => isCellEmpty(cell))
}

export async function parseTasksFile(file: File): Promise<ParseResult<TaskLog>> {
  const issues: ParseIssue[] = []
  const rows = await readRowsFromFile(file)
  if (rows.length === 0) {
    return { records: [], issues: [{ level: "error", message: "Tasks file is empty." }] }
  }

  const headerRow = rows[0] ?? []
  const headers = headerRow.map((value) => normalizeText(value))

  const indexes = {
    id: findColumnIndexByTerms(headers, ["id", "cod"]),
    date: findColumnIndexByTerms(headers, ["data task", "data", "date"]),
    client: findColumnIndexByTerms(headers, ["client", "domeniu"]),
    task: findColumnIndexByTerms(headers, ["denumire task", "task name"]),
    exec: findColumnIndexByTerms(headers, ["executant", "assigned to"]),
    dur: findColumnIndexByTerms(headers, ["durata", "minute", "duration"]),
    status: findColumnIndexByTerms(headers, ["status"]),
  }

  if (indexes.date < 0) {
    issues.push({ level: "warning", message: "Date column was not detected. Dates were left blank." })
  }
  if (indexes.client < 0) {
    issues.push({ level: "warning", message: "Client column was not detected. Clients were set to generic values." })
  }
  if (indexes.exec < 0) {
    issues.push({ level: "warning", message: "Executant column was not detected. Executants were set to Unassigned." })
  }

  const records: TaskLog[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? []
    if (isRowCompletelyEmpty(row)) continue

    const rawDate = getRowCell(row, indexes.date)
    const rawClient = toStringSafe(getRowCell(row, indexes.client))
    const rawExec = toStringSafe(getRowCell(row, indexes.exec))
    const rawTask = toStringSafe(getRowCell(row, indexes.task))
    const rawStatus = toStringSafe(getRowCell(row, indexes.status))
    const rawDuration = getRowCell(row, indexes.dur)
    const parsedDate = parseDateLikeToIso(rawDate)

    if (!parsedDate && !isCellEmpty(rawDate)) {
      issues.push({ level: "warning", message: `Row ${i + 1}: date could not be parsed.` })
    }

    records.push({
      id: toStringSafe(getRowCell(row, indexes.id)) || `row-${i}`,
      date: parsedDate,
      client: rawClient || "Unknown Client",
      taskName: rawTask || "Untitled Task",
      executant: rawExec || "Unassigned",
      durationMinutes: parseDurationToMinutes(rawDuration),
      status: rawStatus || "-",
    })
  }

  return { records, issues }
}

export async function parseAllocationsFile(file: File): Promise<ParseResult<ClientAllocation>> {
  const issues: ParseIssue[] = []
  const rows = await readRowsFromFile(file)
  if (rows.length === 0) {
    return { records: [], issues: [{ level: "error", message: "Allocations file is empty." }] }
  }

  const headers = (rows[0] ?? []).map((value) => normalizeText(value))
  const clientIndex =
    findColumnIndexByTerms(headers, ["Client - domeniu.ro"], "exact") >= 0
      ? findColumnIndexByTerms(headers, ["Client - domeniu.ro"], "exact")
      : findColumnIndexByTerms(headers, ["Client"], "exact")

  if (clientIndex < 0) {
    return {
      records: [],
      issues: [{ level: "error", message: "Required Client column not found in allocations file." }],
    }
  }

  const fadsExactIndex = findColumnIndexByTerms(headers, ["Status serviciu FAds"], "exact")
  const fadsFallbackIndex = findColumnIndexByTerms(
    headers,
    ["Status serviciu FAds", "Status serviciu FB", "Status serviciu Facebook", "Status serviciu MAds", "Status FB", "Status MAds", "FAds", "Facebook", "MAds", "Meta Ads"],
    "partial"
  )

  const indexes = {
    client: clientIndex,
    seo: findColumnIndexByTerms(headers, ["Status serviciu SEO"], "exact"),
    gads: findColumnIndexByTerms(headers, ["Status serviciu GAds"], "exact"),
    fads: fadsExactIndex >= 0 ? fadsExactIndex : fadsFallbackIndex,
    tads:
      findColumnIndexByTerms(headers, ["Status serviciu TAds"], "exact") >= 0
        ? findColumnIndexByTerms(headers, ["Status serviciu TAds"], "exact")
        : findColumnIndexByTerms(headers, ["Status TAds"], "exact"),
    specialist:
      findColumnIndexByTerms(headers, ["Specialist GTM"], "exact") >= 0
        ? findColumnIndexByTerms(headers, ["Specialist GTM"], "exact")
        : findColumnIndexByTerms(headers, ["Specialist"], "exact"),
  }

  if (indexes.fads < 0) {
    issues.push({
      level: "warning",
      message: "FAds column was not detected. FAds statuses were set to '-'",
    })
  }

  const records: ClientAllocation[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? []
    if (isRowCompletelyEmpty(row)) continue

    records.push({
      client: toStringSafe(getRowCell(row, indexes.client)) || "Unknown Client",
      specialist: toStringSafe(getRowCell(row, indexes.specialist)) || "Unassigned",
      seo: normalizeServiceStatus(getRowCell(row, indexes.seo)),
      gads: normalizeServiceStatus(getRowCell(row, indexes.gads)),
      fads: normalizeServiceStatus(getRowCell(row, indexes.fads)),
      tads: normalizeServiceStatus(getRowCell(row, indexes.tads)),
    })
  }

  return { records, issues }
}

export function normalizeClientKey(client: string) {
  return normalizeText(client)
}

export function normalizeExecutantKey(executant: string) {
  return normalizeText(executant)
}
