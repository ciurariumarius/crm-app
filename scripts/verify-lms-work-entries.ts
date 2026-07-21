import assert from "node:assert/strict"
import ExcelJS from "exceljs"
import { matchesLmsClientSearch } from "../lib/lms-work-entries/client-search"
import { isValidDateOnly, normalizeDateRange } from "../lib/lms-work-entries/date"
import {
  buildLmsCrmExportBuffer,
  LMS_CRM_EXPORT_COLUMN_WIDTHS,
  LMS_CRM_EXPORT_HEADERS,
} from "../lib/lms-work-entries/export"

async function run() {
  assert.equal(isValidDateOnly("2026-02-28"), true)
  assert.equal(isValidDateOnly("2026-02-29"), false)
  assert.equal(isValidDateOnly("2024-02-29"), true)
  assert.equal(isValidDateOnly("2026-13-01"), false)
  assert.deepEqual(normalizeDateRange("2026-03-31", "2026-03-01"), {
    from: "2026-03-01",
    to: "2026-03-31",
  })

  const importedClients = Array.from({ length: 850 }, (_, index) => `client-${String(index + 1).padStart(3, "0")}.ro`)
  importedClients.push("Școala Exemplu.ro")
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "CLIENT-800")).length, 1)
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "școala")).length, 1)
  assert.equal(importedClients.filter((client) => matchesLmsClientSearch(client, "missing-client")).length, 0)

  const buffer = await buildLmsCrmExportBuffer([
    {
      workDate: "2026-03-12",
      clientDomainSnapshot: "example.ro",
      taskNameSnapshot: "Meeting / videocall client",
      employeeNameSnapshot: "Marius Ciurariu",
      durationMinutes: 60,
    },
    {
      workDate: "2026-03-13",
      clientDomainSnapshot: "[Intern]",
      taskNameSnapshot: "Comunicare client / coleg - email / telefon",
      employeeNameSnapshot: "Marius Ciurariu",
      durationMinutes: 45,
    },
  ])
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Worksheet"])

  const sheet = workbook.getWorksheet("Worksheet")
  assert.ok(sheet)
  assert.equal(sheet.actualRowCount, 3)
  assert.equal(sheet.actualColumnCount, 41)
  const headerValues = sheet.getRow(1).values
  assert.ok(Array.isArray(headerValues))
  assert.deepEqual(headerValues.slice(1), Array.from(LMS_CRM_EXPORT_HEADERS))
  assert.equal(sheet.getCell("A2").value, null)
  assert.equal(sheet.getCell("B2").value, "2026-03-12")
  assert.equal(sheet.getCell("B2").numFmt, "@")
  assert.equal(sheet.getCell("C2").value, "example.ro")
  assert.equal(sheet.getCell("D2").value, "Meeting / videocall client")
  assert.equal(sheet.getCell("E2").value, "DATA Subdivizie")
  assert.equal(sheet.getCell("F2").value, "Marius Ciurariu")
  assert.equal(sheet.getCell("G2").value, "Marius Ciurariu")
  assert.equal(sheet.getCell("H2").value, "Finalizat")
  assert.equal(sheet.getCell("I2").value, null)
  assert.equal(sheet.getCell("J2").value, 60)
  assert.equal(sheet.getCell("AO2").value, null)
  assert.equal(sheet.getCell("B3").value, "2026-03-13")

  for (const [index, expected] of LMS_CRM_EXPORT_COLUMN_WIDTHS.entries()) {
    assert.ok(Math.abs((sheet.getColumn(index + 1).width ?? 0) - expected) < 0.01)
  }

  const table = sheet.getTable("CRMConsolidatedWithCommunication2026")
  const tableModel = (table as unknown as {
    table: { tableRef: string; columns: unknown[]; style: { theme: string; showRowStripes: boolean } }
  }).table
  assert.equal(tableModel.tableRef, "A1:AO3")
  assert.equal(tableModel.columns.length, 41)
  assert.equal(tableModel.style.theme, "TableStyleMedium2")
  assert.equal(tableModel.style.showRowStripes, true)

  process.stdout.write("verify-lms-work-entries: ok\n")
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
