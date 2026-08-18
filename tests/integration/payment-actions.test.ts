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
    userId: "payment-integration-owner",
    username: "payment-integration-owner",
    twoFactorVerified: true,
  })),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/audit", () => ({ logSessionAuditEvent: mocks.logSessionAuditEvent }))

type PartnerActions = typeof import("@/lib/actions/partners")
type SettlementActions = typeof import("@/lib/actions/settlement")
type ProjectActions = typeof import("@/lib/actions/projects")

let temporaryDirectory = ""
let prisma: PrismaClient
let partnerActions: PartnerActions
let settlementActions: SettlementActions
let projectActions: ProjectActions

async function createPartner(name: string) {
  return prisma.partner.create({ data: { id: randomUUID(), name } })
}

async function createProject(partnerId: string, name: string, paymentStatus = "Unpaid") {
  const suffix = randomUUID()
  const site = await prisma.site.create({
    data: {
      id: randomUUID(),
      partnerId,
      name: `${name} site`,
      domainName: `${suffix}.example`,
    },
  })
  return prisma.project.create({
    data: {
      id: randomUUID(),
      siteId: site.id,
      name,
      currentFee: 250,
      paymentStatus,
    },
  })
}

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "crm-payment-actions-"))
  const databasePath = join(temporaryDirectory, "payment-actions.db")
  closeSync(openSync(databasePath, "w"))
  const databaseUrl = `file:${databasePath}`
  process.env.DATABASE_URL = databaseUrl

  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  })

  prisma = (await import("@/lib/prisma")).default
  partnerActions = await import("@/lib/actions/partners")
  settlementActions = await import("@/lib/actions/settlement")
  projectActions = await import("@/lib/actions/projects")
})

beforeEach(async () => {
  vi.clearAllMocks()
  await prisma.auditLog.deleteMany()
  await prisma.project.deleteMany()
  await prisma.site.deleteMany()
  await prisma.partner.deleteMany()
  await prisma.service.deleteMany()
})

afterAll(async () => {
  await prisma?.$disconnect()
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true })
})

describe("partner payment transactions", () => {
  it("saves manual payments for different partners in separate payment workspaces", async () => {
    const [firstPartner, secondPartner, service] = await Promise.all([
      createPartner(`First partner ${randomUUID()}`),
      createPartner(`Second partner ${randomUUID()}`),
      prisma.service.create({
        data: {
          id: randomUUID(),
          serviceName: `Payment service ${randomUUID()}`,
          isRecurring: false,
          standardTasks: "[]",
        },
      }),
    ])

    const firstResult = await partnerActions.addPartnerAdHocPayment({
      partnerId: firstPartner.id,
      serviceId: service.id,
      name: "First manual payment",
      amount: 120,
      paymentMethod: "Revolut",
    })
    const secondResult = await partnerActions.addPartnerAdHocPayment({
      partnerId: secondPartner.id,
      serviceId: service.id,
      name: "Second manual payment",
      amount: 180,
      paymentMethod: "Cash",
    })

    expect(firstResult).toEqual({ success: true })
    expect(secondResult).toEqual({ success: true })
    const paymentSites = await prisma.site.findMany({
      where: { name: "Ad-Hoc Payments" },
      orderBy: { partnerId: "asc" },
    })
    expect(paymentSites).toHaveLength(2)
    expect(new Set(paymentSites.map((site) => site.domainName)).size).toBe(2)
    expect(new Set(paymentSites.map((site) => site.partnerId))).toEqual(new Set([firstPartner.id, secondPartner.id]))
    expect(await prisma.project.count({ where: { paymentStatus: "Paid" } })).toBe(2)
  })

  it("reverts exactly the projects changed by Mark all paid", async () => {
    const partner = await createPartner(`Settlement partner ${randomUUID()}`)
    const [firstProject, secondProject] = await Promise.all([
      createProject(partner.id, "First unpaid project"),
      createProject(partner.id, "Second unpaid project"),
    ])

    const settlement = await settlementActions.settlePartnerDebt(partner.id)
    expect(settlement).toMatchObject({ success: true, count: 2, amount: 500 })
    if (!settlement.success) throw new Error(settlement.error)
    expect(await prisma.project.count({
      where: { id: { in: [firstProject.id, secondProject.id] }, paymentStatus: "Paid" },
    })).toBe(2)

    const reversal = await settlementActions.voidSettlement(settlement.auditLogId)
    expect(reversal).toEqual({ success: true, count: 2, skippedCount: 0 })
    expect(await prisma.project.count({
      where: { id: { in: [firstProject.id, secondProject.id] }, paymentStatus: "Unpaid", paidAt: null },
    })).toBe(2)

    await expect(settlementActions.voidSettlement(settlement.auditLogId)).resolves.toMatchObject({
      success: false,
      error: "This settlement has already been reverted",
    })
  })

  it("marks an existing project paid with an edited amount and reverses it", async () => {
    const partner = await createPartner(`Direct payment partner ${randomUUID()}`)
    const project = await createProject(partner.id, "Direct payment project")

    const paid = await projectActions.setProjectPaymentState({
      projectId: project.id,
      expectedStatus: "Unpaid",
      nextStatus: "Paid",
      amount: 375,
      paymentMethod: "BT Pay",
    })
    expect(paid).toMatchObject({
      success: true,
      data: { id: project.id, paymentStatus: "Paid", currentFee: 375 },
    })
    expect(paid.success && paid.data.paidAt).toBeTruthy()
    const storedPaid = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(storedPaid.paymentStatus).toBe("Paid")
    expect(Number(storedPaid.currentFee)).toBe(375)
    expect(storedPaid.paymentMethod).toBe("BT Pay")

    const methodUpdate = await projectActions.setProjectPaymentMethod({
      projectId: project.id,
      paymentMethod: "Bank transfer",
    })
    expect(methodUpdate).toEqual({ success: true, data: { paymentMethod: "Bank transfer" } })

    const unpaid = await projectActions.setProjectPaymentState({
      projectId: project.id,
      expectedStatus: "Paid",
      nextStatus: "Unpaid",
    })
    expect(unpaid).toMatchObject({ success: true, data: { paymentStatus: "Unpaid", paidAt: null } })
    const storedUnpaid = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(storedUnpaid.paymentStatus).toBe("Unpaid")
    expect(storedUnpaid.paidAt).toBeNull()
    expect(Number(storedUnpaid.currentFee)).toBe(375)
    expect(storedUnpaid.paymentMethod).toBe("Bank transfer")
  })

  it("rejects stale payment toggles without changing the project", async () => {
    const partner = await createPartner(`Stale payment partner ${randomUUID()}`)
    const project = await createProject(partner.id, "Already paid project", "Paid")

    const result = await projectActions.setProjectPaymentState({
      projectId: project.id,
      expectedStatus: "Unpaid",
      nextStatus: "Paid",
      amount: 999,
    })

    expect(result).toMatchObject({ success: false, code: "PAYMENT_STATE_CHANGED" })
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(stored.paymentStatus).toBe("Paid")
    expect(Number(stored.currentFee)).toBe(250)
  })

  it("changes only the current recurring month when that scope is selected", async () => {
    const partner = await createPartner(`Current month partner ${randomUUID()}`)
    const project = await createProject(partner.id, "Current month recurring project")
    const service = await prisma.service.create({
      data: {
        id: randomUUID(),
        serviceName: `Recurring service ${randomUUID()}`,
        isRecurring: true,
        standardTasks: "[]",
      },
    })
    await prisma.project.update({
      where: { id: project.id },
      data: { recurringBaseFee: null, services: { connect: { id: service.id } } },
    })

    const result = await projectActions.updateProject(project.id, {
      currentFee: 325,
      feeScope: "CURRENT_MONTH",
    })

    expect(result).toEqual({ success: true })
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(Number(stored.currentFee)).toBe(325)
    expect(Number(stored.recurringBaseFee)).toBe(250)
  })

  it("changes both the current and future recurring amounts when that scope is selected", async () => {
    const partner = await createPartner(`Future months partner ${randomUUID()}`)
    const project = await createProject(partner.id, "Future months recurring project")
    const service = await prisma.service.create({
      data: {
        id: randomUUID(),
        serviceName: `Recurring service ${randomUUID()}`,
        isRecurring: true,
        standardTasks: "[]",
      },
    })
    await prisma.project.update({
      where: { id: project.id },
      data: { recurringBaseFee: 250, services: { connect: { id: service.id } } },
    })

    const result = await projectActions.updateProject(project.id, {
      currentFee: 400,
      feeScope: "CURRENT_AND_FUTURE",
    })

    expect(result).toEqual({ success: true })
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(Number(stored.currentFee)).toBe(400)
    expect(Number(stored.recurringBaseFee)).toBe(400)
  })

  it("changes only future recurring amounts without changing the current month", async () => {
    const partner = await createPartner(`Future-only partner ${randomUUID()}`)
    const project = await createProject(partner.id, "Future-only recurring project")
    const service = await prisma.service.create({
      data: {
        id: randomUUID(),
        serviceName: `Recurring service ${randomUUID()}`,
        isRecurring: true,
        standardTasks: "[]",
      },
    })
    await prisma.project.update({
      where: { id: project.id },
      data: { recurringBaseFee: 250, services: { connect: { id: service.id } } },
    })

    const result = await projectActions.updateProject(project.id, {
      currentFee: 475,
      feeScope: "FUTURE_MONTHS",
    })

    expect(result).toEqual({ success: true })
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(Number(stored.currentFee)).toBe(250)
    expect(Number(stored.recurringBaseFee)).toBe(475)
  })

  it("opens a closed recurring project in a later month without changing its history", async () => {
    const partner = await createPartner(`Recurring partner ${randomUUID()}`)
    const site = await prisma.site.create({
      data: {
        id: randomUUID(),
        partnerId: partner.id,
        name: "Optik Tataru",
        domainName: "optiktataru.ro",
      },
    })
    const service = await prisma.service.create({
      data: {
        id: randomUUID(),
        serviceName: "PPC - Facebook Ads",
        isRecurring: true,
        standardTasks: JSON.stringify(["Review campaigns", "Prepare report"]),
      },
    })
    const source = await prisma.project.create({
      data: {
        id: randomUUID(),
        siteId: site.id,
        name: "optiktataru.ro - PPC - Facebook Ads - April 2026",
        status: "Closed",
        paymentStatus: "Paid",
        currentFee: 325,
        recurringBaseFee: 450,
        createdAt: new Date(2026, 3, 1, 12),
        closedAt: new Date(2026, 3, 30, 12),
        closedMonthKey: "2026-04",
        services: { connect: { id: service.id } },
      },
    })

    const first = await projectActions.reopenRecurringProject({
      projectId: source.id,
      targetYear: 2026,
      targetMonth: 8,
    })
    expect(first).toMatchObject({ success: true, data: { created: true } })
    if (!first.success) throw new Error(first.error)

    const target = await prisma.project.findUniqueOrThrow({
      where: { id: first.data.projectId },
      include: { tasks: true },
    })
    expect(target.name).toMatch(/August 2026$/)
    expect(target.status).toBe("Active")
    expect(target.paymentStatus).toBe("Unpaid")
    expect(Number(target.currentFee)).toBe(450)
    expect(target.createdAt.getFullYear()).toBe(2026)
    expect(target.createdAt.getMonth()).toBe(7)
    expect(target.tasks.map((task) => task.name).sort()).toEqual(["Prepare report", "Review campaigns"])

    const unchangedSource = await prisma.project.findUniqueOrThrow({ where: { id: source.id } })
    expect(unchangedSource.status).toBe("Closed")
    expect(unchangedSource.closedMonthKey).toBe("2026-04")
    expect(unchangedSource.paymentStatus).toBe("Paid")

    const retry = await projectActions.reopenRecurringProject({
      projectId: source.id,
      targetYear: 2026,
      targetMonth: 8,
    })
    expect(retry).toEqual({ success: true, data: { projectId: target.id, created: false } })
    expect(await prisma.project.count({ where: { siteId: site.id } })).toBe(2)
  })
})
