import ExcelJS from "exceljs"
import type { LmsWorkExportEntry } from "@/lib/lms-work-entries/types"

export const LMS_CRM_EXPORT_HEADERS = [
  "Id",
  "Data task",
  "Client - domeniu",
  "Denumire task",
  "Task subdivizie",
  "Responsabil",
  "Executant",
  "Status task",
  "Numar livrabile de continut",
  "Durata executie task(minute)",
  "Durata medie task(minute)",
  "Deadline",
  "Observatii",
  "Status task continut (intern)",
  "Link livrabil (tehnical SEO)",
  "Link livrabil (strategie continut SEO)",
  "Link template",
  "Link protocol",
  "Timeline",
  "Tip actiune",
  "Status facturare",
  "Link publisher (LB)",
  "LP promovat (LB)",
  "Ancora keyword (LB)",
  "LP link building (articol publicat)",
  "Link document cuvinte cheie (CM &amp; LSI)",
  "Tema articol/Nume pagina (CM, LSI)",
  "Status task (creator continut)",
  "Link livrabil (creator continut)",
  "Specialist PPC",
  "Link arhiva foto",
  "Indicatii  trimitere articol publisher",
  "Nota evaluare articol",
  "Estimare DEV",
  "Cost DEV (in &euro;)",
  "Estimare client",
  "Cost DEV facturat (in &euro;)",
  "Ore suplimentare DEV",
  "Cost suplimentar DEV (in &euro;)",
  "Ore suplimentare facturate",
  "Cost suplimentar facturat (in &euro;)",
] as const

export const LMS_CRM_EXPORT_COLUMN_WIDTHS = [
  8.140000343322754,
  12.859999656677246,
  22.290000915527344,
  61.290000915527344,
  18.709999084472656,
  18.709999084472656,
  18.709999084472656,
  14,
  33,
  34.13999938964844,
  30.56999969482422,
  10.569999694824219,
  12.859999656677246,
  35.290000915527344,
  34.13999938964844,
  45.86000061035156,
  16.43000030517578,
  16.43000030517578,
  10.569999694824219,
  14,
  20,
  23.43000030517578,
  20,
  23.43000030517578,
  42.43000030517578,
  50.56999969482422,
  41.13999938964844,
  36.43000030517578,
  38.86000061035156,
  17.56999969482422,
  20,
  45.86000061035156,
  25.860000610351562,
  15.289999961853027,
  24.709999084472656,
  18.709999084472656,
  35.290000915527344,
  24.709999084472656,
  38.86000061035156,
  31.709999084472656,
  44.709999084472656,
] as const

export function buildLmsCrmExportRow(entry: LmsWorkExportEntry) {
  const row: Array<string | number | null> = Array.from({ length: LMS_CRM_EXPORT_HEADERS.length }, () => null)
  row[1] = entry.workDate
  row[2] = entry.clientDomainSnapshot
  row[3] = entry.taskNameSnapshot
  row[4] = "DATA Subdivizie"
  row[5] = entry.employeeNameSnapshot
  row[6] = entry.employeeNameSnapshot
  row[7] = "Finalizat"
  row[9] = entry.durationMinutes
  return row
}

export async function buildLmsCrmExportWorkbook(entries: LmsWorkExportEntry[]) {
  if (entries.length === 0) throw new Error("At least one work entry is required")

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Pixelist CRM"
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet("Worksheet")
  worksheet.columns = LMS_CRM_EXPORT_COLUMN_WIDTHS.map((width) => ({ width }))
  worksheet.addTable({
    name: "CRMConsolidatedWithCommunication2026",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: LMS_CRM_EXPORT_HEADERS.map((name) => ({ name })),
    rows: entries.map(buildLmsCrmExportRow),
  })

  worksheet.getColumn(2).numFmt = "@"
  worksheet.eachRow((row) => {
    row.alignment = { vertical: "bottom", wrapText: false }
  })

  return workbook
}

export async function buildLmsCrmExportBuffer(entries: LmsWorkExportEntry[]) {
  const workbook = await buildLmsCrmExportWorkbook(entries)
  return workbook.xlsx.writeBuffer()
}

