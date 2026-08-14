import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PrismaClient } from "@prisma/client"

const MONDAY_TO_FRIDAY = 31
const TUESDAY_THURSDAY = 10

async function run() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "crm-lms-recurring-work-"))
  const databasePath = join(temporaryDirectory, "recurring-work.db")
  const databaseUrl = `file:${databasePath}`
  process.env.DATABASE_URL = databaseUrl
  process.env.CRON_SECRET = "integration-test-cron-secret"
  let prismaClient: PrismaClient | null = null

  try {
    execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "db", "push", "--skip-generate"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: "debug" },
      stdio: "pipe",
    })

    const [prismaModule, automation, cronRoute] = await Promise.all([
      import("../lib/prisma"),
      import("../lib/lms-work-entries/daily-admin-automation"),
      import("../app/api/cron/lms-daily-admin-work/route"),
    ])
    const prisma = prismaModule.default
    prismaClient = prisma

    const allocationId = "10000000-0000-0000-0000-000000000003"
    await prisma.lmsAllocation.create({
      data: {
        id: allocationId,
        syncKey: automation.LMS_DAILY_ADMIN_CLIENT_SYNC_KEY,
        client: automation.LMS_DAILY_ADMIN_CLIENT,
      },
    })

    const taskDefinitions = [
      ["20000000-0000-0000-0000-000000000001", "Task-uri administrative", "task-uri administrative"],
      ["20000000-0000-0000-0000-000000000002", "Meeting / videocall intern ", "meeting / videocall intern"],
      ["20000000-0000-0000-0000-000000000003", "Comunicare client / coleg - email / telefon", "comunicare client / coleg - email / telefon"],
      ["20000000-0000-0000-0000-000000000004", "Dezvoltare", "dezvoltare"],
    ] as const
    for (const [id, name, normalizedName] of taskDefinitions) {
      await prisma.lmsWorkTask.create({ data: { id, name, normalizedName } })
    }

    const ruleDefinitions = [
      ["30000000-0000-0000-0000-000000000001", taskDefinitions[0], 60, MONDAY_TO_FRIDAY],
      ["30000000-0000-0000-0000-000000000002", taskDefinitions[1], 90, TUESDAY_THURSDAY],
      ["30000000-0000-0000-0000-000000000003", taskDefinitions[2], 30, MONDAY_TO_FRIDAY],
      ["30000000-0000-0000-0000-000000000004", taskDefinitions[3], 60, MONDAY_TO_FRIDAY],
    ] as const
    for (const [id, task, durationMinutes, weekdayMask] of ruleDefinitions) {
      await prisma.lmsWorkRecurrence.create({
        data: {
          id,
          lmsAllocationId: allocationId,
          taskTypeId: task[0],
          clientSnapshot: "[Intern]",
          taskSnapshot: task[1],
          durationMinutes,
          weekdayMask,
          startsOn: "2026-07-20",
        },
      })
    }

    const manualCommunication = await prisma.lmsWorkEntry.create({
      data: {
        lmsAllocationId: allocationId,
        taskTypeId: taskDefinitions[2][0],
        workDate: "2026-07-20",
        durationMinutes: 30,
        clientDomainSnapshot: "[Intern]",
        taskNameSnapshot: taskDefinitions[2][1],
        employeeNameSnapshot: "Marius Ciurariu",
      },
    })

    const dryRun = await automation.runLmsDailyAdminAutomation({
      now: new Date("2026-07-21T06:05:00.000Z"),
      dryRun: true,
    })
    assert.equal(dryRun.summary.rulesProcessed, 4)
    assert.equal(dryRun.summary.entriesCreated, 6)
    assert.equal(dryRun.summary.entriesAdopted, 1)
    assert.equal((await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { id: manualCommunication.id } })).sourceKey, null)
    assert.equal((await prisma.lmsWorkRecurrence.findFirstOrThrow()).processedThrough, null)

    const firstRun = await automation.runLmsDailyAdminAutomation({
      now: new Date("2026-07-21T06:05:00.000Z"),
    })
    assert.equal(firstRun.summary.entriesCreated, 6)
    assert.equal(firstRun.summary.entriesAdopted, 1)
    assert.equal(firstRun.summary.failedRules, 0)
    assert.equal(
      (await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { id: manualCommunication.id } })).sourceKey,
      `recurrence:${ruleDefinitions[2][0]}`
    )
    assert.equal(
      (await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { id: manualCommunication.id } })).origin,
      "RECURRENCE"
    )
    const meetingEntry = await prisma.lmsWorkEntry.findFirstOrThrow({
      where: { sourceKey: `recurrence:${ruleDefinitions[1][0]}` },
    })
    assert.equal(meetingEntry.taskNameSnapshot, "Meeting / videocall intern ")
    assert.equal(meetingEntry.exportedAt, null)
    assert.equal(meetingEntry.employeeNameSnapshot, "Marius Ciurariu")
    assert.equal(meetingEntry.origin, "RECURRENCE")

    const repeated = await automation.runLmsDailyAdminAutomation({
      now: new Date("2026-07-21T07:05:00.000Z"),
    })
    assert.equal(repeated.summary.alreadyProcessed, 4)
    assert.equal(repeated.summary.entriesCreated, 0)

    const catchUp = await automation.runLmsDailyAdminAutomation({
      now: new Date("2026-07-23T06:05:00.000Z"),
    })
    assert.equal(catchUp.summary.entriesCreated, 7)
    assert.equal(catchUp.summary.failedRules, 0)

    await prisma.lmsWorkRecurrence.updateMany({
      data: { processedThrough: "2026-11-30" },
    })
    const holiday = await automation.runLmsDailyAdminAutomation({
      now: new Date("2026-12-01T06:05:00.000Z"),
    })
    assert.equal(holiday.summary.entriesCreated, 0)
    assert.equal(holiday.summary.skippedNonWorkingDates, 4)

    await prisma.lmsWorkTask.update({
      where: { id: taskDefinitions[3][0] },
      data: { isActive: false },
    })
    const partialFailure = await automation.runLmsDailyAdminAutomation({
      now: new Date("2026-12-02T06:05:00.000Z"),
    })
    assert.equal(partialFailure.summary.failedRules, 1)
    assert.equal(partialFailure.summary.entriesCreated, 2)
    assert.equal(partialFailure.summary.results.find((result) => result.ruleId === ruleDefinitions[3][0])?.errorCode, "LMS_RECURRENCE_TASK_INACTIVE")
    assert.equal(
      (await prisma.lmsWorkRecurrence.findUniqueOrThrow({ where: { id: ruleDefinitions[3][0] } })).processedThrough,
      "2026-12-01"
    )
    const partialFailureResponse = await cronRoute.POST(new Request("http://localhost/api/cron/lms-daily-admin-work?dryRun=1", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }))
    assert.equal(partialFailureResponse.status, 500)
    assert.equal((await partialFailureResponse.json()).failedRules, 1)
    await prisma.lmsWorkTask.update({ where: { id: taskDefinitions[3][0] }, data: { isActive: true } })

    const simultaneous = await Promise.all([
      automation.runLmsDailyAdminAutomation({ now: new Date("2026-12-03T06:05:00.000Z") }),
      automation.runLmsDailyAdminAutomation({ now: new Date("2026-12-03T06:05:00.000Z") }),
    ])
    assert.equal(simultaneous.length, 2)
    assert.equal(simultaneous[0].summary.failedRules, 0)
    assert.equal(simultaneous[1].summary.failedRules, 0)
    for (const [ruleId] of ruleDefinitions) {
      assert.equal(
        await prisma.lmsWorkEntry.count({ where: { sourceKey: `recurrence:${ruleId}`, workDate: "2026-12-03" } }),
        1
      )
    }

    const deleted = await prisma.lmsWorkEntry.findFirstOrThrow({
      where: { sourceKey: `recurrence:${ruleDefinitions[0][0]}`, workDate: "2026-12-03" },
    })
    await prisma.lmsWorkEntry.delete({ where: { id: deleted.id } })
    await automation.runLmsDailyAdminAutomation({ now: new Date("2026-12-03T08:05:00.000Z") })
    assert.equal(await prisma.lmsWorkEntry.count({ where: { id: deleted.id } }), 0)

    const unauthorized = await cronRoute.POST(new Request("http://localhost/api/cron/lms-daily-admin-work", { method: "POST" }))
    assert.equal(unauthorized.status, 401)
    const authorizedDryRun = await cronRoute.POST(new Request("http://localhost/api/cron/lms-daily-admin-work?dryRun=1", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }))
    assert.equal(authorizedDryRun.status, 200)
    const authorizedPayload = await authorizedDryRun.json()
    assert.equal(authorizedPayload.dryRun, true)
    assert.equal(authorizedPayload.rulesProcessed, 4)
    assert.equal(authorizedPayload.username, undefined)
    assert.equal((await cronRoute.GET()).status, 405)

    process.stdout.write("verify-lms-daily-admin-integration: ok\n")
  } finally {
    await prismaClient?.$disconnect()
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
