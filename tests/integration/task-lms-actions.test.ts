import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  logSessionAuditEvent: vi.fn(async () => undefined),
  requireAuth: vi.fn(async () => ({
    userId: "integration-owner",
    username: "integration-owner",
    twoFactorVerified: true,
  })),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/audit", () => ({ logSessionAuditEvent: mocks.logSessionAuditEvent }))

type TaskActions = typeof import("@/lib/actions/tasks")
type TimeActions = typeof import("@/lib/actions/time")
type WorkEntryActions = typeof import("@/lib/actions/lms-work-entries")

let temporaryDirectory = ""
let prisma: PrismaClient
let taskActions: TaskActions
let timeActions: TimeActions
let workEntryActions: WorkEntryActions

async function createAllocation(client = "client.example") {
  return prisma.lmsAllocation.create({
    data: { id: randomUUID(), syncKey: `test:${randomUUID()}`, client },
  })
}

async function createWorkTask(name = "Development", isActive = true) {
  return prisma.lmsWorkTask.create({
    data: {
      id: randomUUID(),
      name,
      normalizedName: `${name.toLocaleLowerCase("ro-RO")}:${randomUUID()}`,
      isActive,
    },
  })
}

async function createLmsTask(name = "CRM LMS task") {
  return prisma.task.create({
    data: { id: randomUUID(), name, taskScope: "LMS", status: "Active" },
  })
}

async function createFreelanceProject(name = "Freelance project") {
  const suffix = randomUUID()
  const partner = await prisma.partner.create({
    data: { id: randomUUID(), name: `Partner ${suffix}` },
  })
  const site = await prisma.site.create({
    data: {
      id: randomUUID(),
      partnerId: partner.id,
      name: `Site ${suffix}`,
      domainName: `${suffix}.example`,
    },
  })
  return prisma.project.create({
    data: { id: randomUUID(), siteId: site.id, name },
  })
}

async function completeFixture(name = "CRM LMS task") {
  const [allocation, workTask, task] = await Promise.all([
    createAllocation(),
    createWorkTask(),
    createLmsTask(name),
  ])
  const completion = {
    lmsAllocationId: allocation.id,
    lmsTaskTypeId: workTask.id,
    workDate: "2026-08-13",
    durationMinutes: 90,
  }
  const result = await taskActions.completeTask(task.id, completion)
  expect(result.success).toBe(true)
  return { allocation, workTask, task, completion }
}

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "crm-task-lms-actions-"))
  const databasePath = join(temporaryDirectory, "task-lms-actions.db")
  closeSync(openSync(databasePath, "w"))
  const databaseUrl = `file:${databasePath}`
  process.env.DATABASE_URL = databaseUrl

  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  })

  prisma = (await import("@/lib/prisma")).default
  taskActions = await import("@/lib/actions/tasks")
  timeActions = await import("@/lib/actions/time")
  workEntryActions = await import("@/lib/actions/lms-work-entries")
})

beforeEach(async () => {
  vi.clearAllMocks()
  await prisma.lmsWorkEntry.deleteMany()
  await prisma.timeLog.deleteMany()
  await prisma.task.deleteMany()
  await prisma.lmsWorkRecurrence.deleteMany()
  await prisma.lmsAllocation.deleteMany()
  await prisma.lmsWorkTask.deleteMany()
})

afterAll(async () => {
  await prisma?.$disconnect()
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true })
})

describe("Task to LMS work-entry transactions", () => {
  it.each([
    ["implicit", undefined],
    ["explicit", { taskScope: "GENERAL" as const }],
  ])("rejects %s standalone task creation", async (_label, options) => {
    const result = await taskActions.addTask(null, "Standalone task", options)

    expect(result).toMatchObject({ success: false, code: "TASK_TARGET_REQUIRED" })
    expect(await prisma.task.count({ where: { name: "Standalone task" } })).toBe(0)
  })

  it("creates and later edits planned time for freelance and LMS tasks", async () => {
    const project = await createFreelanceProject("Timed freelance project")
    const [freelanceResult, lmsResult] = await Promise.all([
      taskActions.addTask(project.id, "Timed freelance task", {
        taskScope: "FREELANCE",
        estimatedMinutes: 30,
      }),
      taskActions.addTask(null, "Timed LMS task", {
        taskScope: "LMS",
        estimatedMinutes: 45,
      }),
    ])

    expect(freelanceResult.success).toBe(true)
    expect(lmsResult.success).toBe(true)
    const freelanceTaskId = "data" in freelanceResult ? freelanceResult.data?.taskId : undefined
    const lmsTaskId = "data" in lmsResult ? lmsResult.data?.taskId : undefined
    expect(freelanceTaskId).toBeTruthy()
    expect(lmsTaskId).toBeTruthy()
    if (!freelanceTaskId || !lmsTaskId) throw new Error("Expected created task ids")

    await expect(prisma.task.findUniqueOrThrow({ where: { id: freelanceTaskId } })).resolves.toMatchObject({
      taskScope: "FREELANCE",
      estimatedMinutes: 30,
    })
    await expect(prisma.task.findUniqueOrThrow({ where: { id: lmsTaskId } })).resolves.toMatchObject({
      taskScope: "LMS",
      estimatedMinutes: 45,
    })

    expect(await taskActions.updateTask(freelanceTaskId, { estimatedMinutes: 75 })).toMatchObject({ success: true })
    expect(await taskActions.updateTask(lmsTaskId, { estimatedMinutes: null })).toMatchObject({ success: true })

    await expect(prisma.task.findUniqueOrThrow({ where: { id: freelanceTaskId } })).resolves.toMatchObject({ estimatedMinutes: 75 })
    await expect(prisma.task.findUniqueOrThrow({ where: { id: lmsTaskId } })).resolves.toMatchObject({ estimatedMinutes: null })
  })

  it("rejects zero planned minutes", async () => {
    const project = await createFreelanceProject("Invalid time project")
    const result = await taskActions.addTask(project.id, "Invalid time task", {
      taskScope: "FREELANCE",
      estimatedMinutes: 0,
    })

    expect(result).toMatchObject({ success: false })
    expect(await prisma.task.count({ where: { name: "Invalid time task" } })).toBe(0)
  })

  it("transitions a task target from general to freelance to LMS and back to general", async () => {
    const [task, project, allocation, workTask] = await Promise.all([
      prisma.task.create({
        data: { id: randomUUID(), name: "Shared target task", taskScope: "GENERAL", status: "Active" },
      }),
      createFreelanceProject(),
      createAllocation("transition.example"),
      createWorkTask("Transition category"),
    ])

    const freelanceResult = await taskActions.updateTask(task.id, {
      taskScope: "FREELANCE",
      projectId: project.id,
    })
    expect(freelanceResult.success).toBe(true)
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      taskScope: "FREELANCE",
      projectId: project.id,
      lmsAllocationId: null,
      lmsTaskTypeId: null,
    })

    const lmsResult = await taskActions.updateTask(task.id, {
      taskScope: "LMS",
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: workTask.id,
    })
    expect(lmsResult.success).toBe(true)
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      taskScope: "LMS",
      projectId: null,
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: workTask.id,
    })

    const generalResult = await taskActions.updateTask(task.id, { taskScope: "GENERAL" })
    expect(generalResult.success).toBe(true)
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      taskScope: "GENERAL",
      projectId: null,
      lmsAllocationId: null,
      lmsTaskTypeId: null,
    })
  })

  it.each([
    ["status", "Completed"],
    ["isCompleted", true],
  ] as const)("rejects the legacy %s bypass without mutating metadata", async (field, value) => {
    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        name: "Original task metadata",
        taskScope: "GENERAL",
        status: "Active",
        urgency: "Normal",
        estimatedMinutes: 15,
      },
    })
    const legacyUpdateTask = taskActions.updateTask as unknown as (
      taskId: string,
      data: Record<string, unknown>
    ) => Promise<{ success: boolean; code?: string }>

    const result = await legacyUpdateTask(task.id, {
      name: "Mutated task metadata",
      urgency: "Urgent",
      estimatedMinutes: 999,
      [field]: value,
    })

    expect(result).toMatchObject({ success: false, code: "TASK_STATUS_ACTION_REQUIRED" })
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      name: "Original task metadata",
      taskScope: "GENERAL",
      status: "Active",
      urgency: "Normal",
      estimatedMinutes: 15,
    })
  })

  it("rejects creating an LMS task directly as completed", async () => {
    const [allocation, workTask] = await Promise.all([
      createAllocation("direct-completed.example"),
      createWorkTask("Direct completed category"),
    ])

    const result = await taskActions.addTask(null, "Direct completed LMS task", {
      taskScope: "LMS",
      status: "Completed",
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: workTask.id,
    })

    expect(result).toMatchObject({ success: false, code: "LMS_COMPLETION_DETAILS_REQUIRED" })
    expect(await prisma.task.count({ where: { name: "Direct completed LMS task" } })).toBe(0)
    expect(await prisma.lmsWorkEntry.count()).toBe(0)
  })

  it.each([
    ["another freelance project", "FREELANCE"],
    ["general", "GENERAL"],
    ["LMS", "LMS"],
  ] as const)("blocks moving a timed task to %s while its timer is open", async (_label, targetScope) => {
    const [sourceProject, targetProject, allocation, workTask] = await Promise.all([
      createFreelanceProject("Timer source"),
      createFreelanceProject("Timer target"),
      createAllocation("timer-target.example"),
      createWorkTask("Timer target category"),
    ])
    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        projectId: sourceProject.id,
        taskScope: "FREELANCE",
        name: "Task with open timer",
      },
    })
    const timer = await timeActions.startTimer(sourceProject.id, task.id, task.name)
    expect(timer.success).toBe(true)

    const result = targetScope === "FREELANCE"
      ? await taskActions.updateTask(task.id, { taskScope: targetScope, projectId: targetProject.id })
      : targetScope === "LMS"
        ? await taskActions.updateTask(task.id, {
          taskScope: targetScope,
          lmsAllocationId: allocation.id,
          lmsTaskTypeId: workTask.id,
        })
        : await taskActions.updateTask(task.id, { taskScope: targetScope })

    expect(result).toMatchObject({
      success: false,
      code: "TASK_TARGET_LOCKED_BY_ACTIVE_TIMER",
    })
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      projectId: sourceProject.id,
      taskScope: "FREELANCE",
    })
    expect(await prisma.timeLog.findFirstOrThrow({ where: { taskId: task.id, endTime: null } })).toMatchObject({
      projectId: sourceProject.id,
    })
  })

  it("blocks a project move while the task timer is paused", async () => {
    const [sourceProject, targetProject] = await Promise.all([
      createFreelanceProject("Paused timer source"),
      createFreelanceProject("Paused timer target"),
    ])
    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        projectId: sourceProject.id,
        taskScope: "FREELANCE",
        name: "Task with paused timer",
      },
    })
    const timer = await timeActions.startTimer(sourceProject.id, task.id, task.name)
    expect(timer.success).toBe(true)
    if (!timer.success) throw new Error("Timer fixture failed")
    const paused = await timeActions.pauseTimer(timer.data.id)
    expect(paused.success).toBe(true)

    const result = await taskActions.updateTask(task.id, {
      taskScope: "FREELANCE",
      projectId: targetProject.id,
    })
    expect(result).toMatchObject({
      success: false,
      code: "TASK_TARGET_LOCKED_BY_ACTIVE_TIMER",
    })
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      projectId: sourceProject.id,
      taskScope: "FREELANCE",
    })
  })

  it("never leaves a concurrent timer and target move on different projects", async () => {
    const [sourceProject, targetProject] = await Promise.all([
      createFreelanceProject("Race timer source"),
      createFreelanceProject("Race timer target"),
    ])
    const task = await prisma.task.create({
      data: {
        id: randomUUID(),
        projectId: sourceProject.id,
        taskScope: "FREELANCE",
        name: "Concurrent timer target",
      },
    })

    const [timerResult, moveResult] = await Promise.all([
      timeActions.startTimer(sourceProject.id, task.id, task.name),
      taskActions.updateTask(task.id, {
        taskScope: "FREELANCE",
        projectId: targetProject.id,
      }),
    ])

    const [storedTask, openLog] = await Promise.all([
      prisma.task.findUniqueOrThrow({ where: { id: task.id } }),
      prisma.timeLog.findFirst({ where: { taskId: task.id, endTime: null } }),
    ])
    if (openLog) expect(openLog.projectId).toBe(storedTask.projectId)
    expect(timerResult.success && moveResult.success).toBe(false)
    expect(timerResult.success || moveResult.success).toBe(true)
  })

  it("completes atomically and keeps retries idempotent", async () => {
    const { task, completion, allocation, workTask } = await completeFixture("Prepare LMS report")

    const retry = await taskActions.completeTask(task.id, completion)
    expect(retry.success).toBe(true)
    expect(retry.success && retry.data.lmsEntryAlreadyExists).toBe(true)
    expect(await prisma.lmsWorkEntry.count({ where: { crmTaskId: task.id } })).toBe(1)

    const storedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    const entry = await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { crmTaskId: task.id } })
    expect(storedTask).toMatchObject({
      status: "Completed",
      taskScope: "LMS",
      projectId: null,
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: workTask.id,
    })
    expect(entry).toMatchObject({
      origin: "CRM_TASK",
      sourceKey: `crm-task:${task.id}`,
      taskNameSnapshot: workTask.name,
      crmTaskNameSnapshot: task.name,
      durationMinutes: 90,
    })
  })

  it("keeps multiple task-time sessions and completes LMS from their total", async () => {
    const [allocation, workTask, task] = await Promise.all([
      createAllocation("sessions.example"),
      createWorkTask("Session category"),
      createLmsTask("Multi-session task"),
    ])
    await prisma.task.update({
      where: { id: task.id },
      data: { lmsAllocationId: allocation.id, lmsTaskTypeId: workTask.id },
    })

    const first = await timeActions.addTaskTimeEntry({ taskId: task.id, minutes: 60 })
    const second = await timeActions.addTaskTimeEntry({ taskId: task.id, minutes: 40 })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(await prisma.timeLog.count({ where: { taskId: task.id } })).toBe(2)

    const readiness = await taskActions.getTaskCompletionReadiness(task.id)
    expect(readiness).toMatchObject({ success: true, data: { trackedMinutes: 100 } })

    const completed = await taskActions.completeTask(task.id)
    expect(completed.success).toBe(true)
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: "Completed" })
    expect(await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { crmTaskId: task.id } })).toMatchObject({
      durationMinutes: 100,
      lmsAllocationId: allocation.id,
      taskTypeId: workTask.id,
    })

    const edited = await timeActions.setTaskTimeTotal({ taskId: task.id, totalMinutes: 90 })
    expect(edited.success).toBe(true)
    const logs = await prisma.timeLog.findMany({ where: { taskId: task.id } })
    expect(logs.reduce((total, log) => total + (log.durationSeconds || 0), 0)).toBe(90 * 60)
    expect(await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { crmTaskId: task.id } })).toMatchObject({
      durationMinutes: 90,
    })
  })

  it("handles concurrent completion without duplicate work rows", async () => {
    const [allocation, workTask, task] = await Promise.all([
      createAllocation("concurrent.example"),
      createWorkTask("Concurrent category"),
      createLmsTask("Concurrent completion"),
    ])
    const completion = {
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: workTask.id,
      workDate: "2026-08-13",
      durationMinutes: 60,
    }

    const results = await Promise.all([
      taskActions.completeTask(task.id, completion),
      taskActions.completeTask(task.id, completion),
    ])

    expect(results.every((result) => result.success)).toBe(true)
    expect(await prisma.lmsWorkEntry.count({ where: { crmTaskId: task.id } })).toBe(1)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("Completed")
  })

  it("rejects inactive or detached mappings and leaves the task active", async () => {
    const [allocation, inactiveTaskType, task] = await Promise.all([
      createAllocation("inactive.example"),
      createWorkTask("Inactive category", false),
      createLmsTask("Invalid completion"),
    ])

    const inactiveResult = await taskActions.completeTask(task.id, {
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: inactiveTaskType.id,
      workDate: "2026-08-13",
      durationMinutes: 30,
    })
    expect(inactiveResult.success).toBe(false)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("Active")
    expect(await prisma.lmsWorkEntry.count({ where: { crmTaskId: task.id } })).toBe(0)

    const activeTaskType = await createWorkTask("Active category")
    await prisma.lmsAllocation.delete({ where: { id: allocation.id } })
    const detachedResult = await taskActions.completeTask(task.id, {
      lmsAllocationId: allocation.id,
      lmsTaskTypeId: activeTaskType.id,
      workDate: "2026-08-13",
      durationMinutes: 30,
    })
    expect(detachedResult.success).toBe(false)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("Active")
  })

  it("deletes unexported work on reopen and preserves exported history on reopen and recompletion", async () => {
    const first = await completeFixture("Unexported reopen")
    const firstEntry = await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { crmTaskId: first.task.id } })
    const unexportedReopen = await taskActions.reopenTask(first.task.id)
    expect(unexportedReopen).toMatchObject({
      success: true,
      data: { entryDeleted: true, exportedEntryPreserved: false },
    })
    expect(await prisma.lmsWorkEntry.findUnique({ where: { id: firstEntry.id } })).toBeNull()
    expect((await prisma.task.findUniqueOrThrow({ where: { id: first.task.id } })).status).toBe("Active")

    const second = await completeFixture("Exported reopen")
    const exportedAt = new Date("2026-08-14T08:00:00.000Z")
    const secondEntry = await prisma.lmsWorkEntry.update({
      where: { crmTaskId: second.task.id },
      data: { exportedAt },
    })
    const exportedReopen = await taskActions.reopenTask(second.task.id)
    expect(exportedReopen.success).toBe(true)
    expect(exportedReopen.success && exportedReopen.data.exportedEntryPreserved).toBe(true)
    expect(exportedReopen.success && exportedReopen.warning).toMatch(/preserved/i)
    expect(await prisma.lmsWorkEntry.findUnique({ where: { id: secondEntry.id } })).not.toBeNull()

    const recompleted = await taskActions.completeTask(second.task.id, second.completion)
    expect(recompleted.success).toBe(true)
    expect(await prisma.lmsWorkEntry.count({ where: { crmTaskId: second.task.id } })).toBe(1)
  })

  it("blocks mixed LMS bulk status changes without partial updates", async () => {
    const [generalTask, lmsTask] = await Promise.all([
      prisma.task.create({
        data: { id: randomUUID(), name: "General bulk task", taskScope: "GENERAL", status: "Active" },
      }),
      createLmsTask("LMS bulk task"),
    ])

    const result = await taskActions.updateTasksStatus([generalTask.id, lmsTask.id], "Completed")
    expect(result.success).toBe(false)
    const stored = await prisma.task.findMany({
      where: { id: { in: [generalTask.id, lmsTask.id] } },
      select: { status: true },
    })
    expect(stored.map((task) => task.status)).toEqual(["Active", "Active"])
  })

  it("updates unexported CRM entries with their task mapping and locks exported corrections", async () => {
    const fixture = await completeFixture("Correct work entry")
    const [nextAllocation, nextTaskType] = await Promise.all([
      createAllocation("corrected.example"),
      createWorkTask("Corrected category"),
    ])
    const entry = await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { crmTaskId: fixture.task.id } })

    const corrected = await workEntryActions.updateLmsWorkEntry(entry.id, {
      lmsAllocationId: nextAllocation.id,
      taskTypeId: nextTaskType.id,
      workDate: "2026-08-14",
      durationMinutes: 120,
    })
    expect(corrected.success).toBe(true)
    expect(await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({
      lmsAllocationId: nextAllocation.id,
      taskTypeId: nextTaskType.id,
      workDate: "2026-08-14",
      durationMinutes: 120,
      clientDomainSnapshot: nextAllocation.client,
      taskNameSnapshot: nextTaskType.name,
    })
    expect(await prisma.task.findUniqueOrThrow({ where: { id: fixture.task.id } })).toMatchObject({
      lmsAllocationId: nextAllocation.id,
      lmsTaskTypeId: nextTaskType.id,
    })

    await prisma.lmsWorkEntry.update({ where: { id: entry.id }, data: { exportedAt: new Date() } })
    const locked = await workEntryActions.updateLmsWorkEntry(entry.id, {
      lmsAllocationId: fixture.allocation.id,
      taskTypeId: fixture.workTask.id,
      workDate: "2026-08-13",
      durationMinutes: 30,
    })
    expect(locked.success).toBe(false)
    expect(await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({
      lmsAllocationId: nextAllocation.id,
      taskTypeId: nextTaskType.id,
      durationMinutes: 120,
    })
  })

  it("keeps snapshots while allocation, category, and task relations detach with SetNull", async () => {
    const fixture = await completeFixture("Historical CRM title")
    const entry = await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { crmTaskId: fixture.task.id } })
    await prisma.lmsWorkEntry.update({ where: { id: entry.id }, data: { exportedAt: new Date() } })

    await prisma.lmsAllocation.delete({ where: { id: fixture.allocation.id } })
    await prisma.lmsWorkTask.delete({ where: { id: fixture.workTask.id } })
    await prisma.task.delete({ where: { id: fixture.task.id } })

    const historical = await prisma.lmsWorkEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(historical).toMatchObject({
      lmsAllocationId: null,
      taskTypeId: null,
      crmTaskId: null,
      clientDomainSnapshot: fixture.allocation.client,
      taskNameSnapshot: fixture.workTask.name,
      crmTaskNameSnapshot: fixture.task.name,
      origin: "CRM_TASK",
    })
    expect(historical.exportedAt).not.toBeNull()
  })
})
