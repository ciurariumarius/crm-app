import { Prisma } from "@prisma/client"
import { LMS_CRM_EMPLOYEE_NAME } from "@/lib/lms-work-entries/crm-template"
import {
  addDateOnlyDays,
  getBucharestDateOnly,
  getDateOnlyRange,
  isRomanianLegalHoliday,
} from "@/lib/lms-work-entries/date"
import { recurrenceRunsOnDate } from "@/lib/lms-work-entries/recurrence"
import prisma from "@/lib/prisma"

export const LMS_DAILY_ADMIN_OWNER_USERNAME = "mxa95"
export const LMS_DAILY_ADMIN_CLIENT = "[Intern]"
export const LMS_DAILY_ADMIN_CLIENT_SYNC_KEY = "client:intern"
export const LMS_DAILY_ADMIN_TASK = "Task-uri administrative"
export const LMS_DAILY_ADMIN_TASK_NORMALIZED_NAME = "task-uri administrative"
export const LMS_DAILY_ADMIN_DURATION_MINUTES = 60
export const LMS_RECURRENCE_SOURCE_PREFIX = "recurrence:"

type AutomationContext = {
  tenantId: string
  userId: string
}

type AutomationDb = Pick<Prisma.TransactionClient, "lmsWorkEntry" | "lmsWorkRecurrence">

type RecurrenceRecord = {
  id: string
  tenantId: string
  lmsAllocationId: string | null
  taskTypeId: string
  clientSnapshot: string
  taskSnapshot: string
  durationMinutes: number
  weekdayMask: number
  startsOn: string | null
  processedThrough: string | null
  lmsAllocation: { id: string } | null
  taskType: { id: string; isActive: boolean }
}

export type LmsRecurringRuleRunResult = {
  ruleId: string
  client: string
  task: string
  processedFrom: string | null
  processedThrough: string | null
  created: number
  adopted: number
  skippedNonWorkingDates: number
  alreadyProcessed: boolean
  status: "completed" | "failed"
  errorCode?: string
  error?: string
}

export type LmsRecurringWorkRunSummary = {
  date: string
  rulesProcessed: number
  entriesCreated: number
  entriesAdopted: number
  skippedNonWorkingDates: number
  failedRules: number
  alreadyProcessed: number
  results: LmsRecurringRuleRunResult[]
}

export class LmsDailyAdminAutomationError extends Error {
  code: string
  status: number
  context?: AutomationContext
  ruleId?: string

  constructor(
    code: string,
    message: string,
    status = 503,
    context?: AutomationContext,
    ruleId?: string
  ) {
    super(message)
    this.name = "LmsDailyAdminAutomationError"
    this.code = code
    this.status = status
    this.context = context
    this.ruleId = ruleId
  }
}

function isRetryableAutomationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2002" || error.code === "P2034")
}

async function resolveAutomationOwner(): Promise<AutomationContext> {
  const user = await prisma.user.findUnique({
    where: { username: LMS_DAILY_ADMIN_OWNER_USERNAME },
    select: { id: true, tenantId: true },
  })
  if (!user) {
    throw new LmsDailyAdminAutomationError(
      "LMS_RECURRING_OWNER_NOT_FOUND",
      "The LMS application owner account was not found"
    )
  }
  return { tenantId: user.tenantId, userId: user.id }
}

function validateRule(rule: RecurrenceRecord, context: AutomationContext) {
  if (!rule.lmsAllocationId || !rule.lmsAllocation) {
    throw new LmsDailyAdminAutomationError(
      "LMS_RECURRENCE_CLIENT_DETACHED",
      "The configured LMS client is no longer available",
      503,
      context,
      rule.id
    )
  }
  if (!rule.taskType.isActive) {
    throw new LmsDailyAdminAutomationError(
      "LMS_RECURRENCE_TASK_INACTIVE",
      "The configured work-entry task is inactive",
      503,
      context,
      rule.id
    )
  }
}

async function reconcileRule(
  db: AutomationDb,
  context: AutomationContext,
  rule: RecurrenceRecord,
  today: string,
  now: Date,
  dryRun: boolean
): Promise<LmsRecurringRuleRunResult> {
  validateRule(rule, context)
  const startsOn = rule.startsOn ?? today
  const processedFrom = rule.processedThrough
    ? addDateOnlyDays(rule.processedThrough, 1)
    : startsOn
  const allDates = processedFrom <= today ? getDateOnlyRange(processedFrom, today) : []
  const eligibleDates = allDates.filter((date) => (
    recurrenceRunsOnDate(rule.weekdayMask, date) && !isRomanianLegalHoliday(date)
  ))
  const sourceKey = `${LMS_RECURRENCE_SOURCE_PREFIX}${rule.id}`

  if (allDates.length === 0) {
    if (!dryRun) {
      await db.lmsWorkRecurrence.update({
        where: { id: rule.id },
        data: { lastRunAt: now, ...(rule.startsOn ? {} : { startsOn }) },
      })
    }
    return {
      ruleId: rule.id,
      client: rule.clientSnapshot,
      task: rule.taskSnapshot,
      processedFrom: null,
      processedThrough: rule.processedThrough,
      created: 0,
      adopted: 0,
      skippedNonWorkingDates: 0,
      alreadyProcessed: true,
      status: "completed",
    }
  }

  const [automaticEntries, matchingManualEntries] = await Promise.all([
    db.lmsWorkEntry.findMany({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
        sourceKey,
        workDate: { in: eligibleDates },
      },
      select: { workDate: true },
    }),
    db.lmsWorkEntry.findMany({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
        sourceKey: null,
        lmsAllocationId: rule.lmsAllocationId,
        taskTypeId: rule.taskTypeId,
        clientDomainSnapshot: rule.clientSnapshot,
        taskNameSnapshot: rule.taskSnapshot,
        durationMinutes: rule.durationMinutes,
        workDate: { in: eligibleDates },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, workDate: true },
    }),
  ])
  const automaticDates = new Set(automaticEntries.map((entry) => entry.workDate))
  const manualEntryByDate = new Map<string, string>()
  for (const entry of matchingManualEntries) {
    if (!manualEntryByDate.has(entry.workDate)) manualEntryByDate.set(entry.workDate, entry.id)
  }

  let created = 0
  let adopted = 0
  for (const workDate of eligibleDates) {
    if (automaticDates.has(workDate)) continue
    const manualEntryId = manualEntryByDate.get(workDate)
    if (manualEntryId) {
      adopted += 1
      if (!dryRun) {
        await db.lmsWorkEntry.update({ where: { id: manualEntryId }, data: { sourceKey } })
      }
      continue
    }

    created += 1
    if (!dryRun) {
      await db.lmsWorkEntry.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          lmsAllocationId: rule.lmsAllocationId,
          taskTypeId: rule.taskTypeId,
          workDate,
          durationMinutes: rule.durationMinutes,
          clientDomainSnapshot: rule.clientSnapshot,
          taskNameSnapshot: rule.taskSnapshot,
          employeeNameSnapshot: LMS_CRM_EMPLOYEE_NAME,
          sourceKey,
        },
      })
    }
  }

  if (!dryRun) {
    await db.lmsWorkRecurrence.update({
      where: { id: rule.id },
      data: { startsOn, processedThrough: today, lastRunAt: now },
    })
  }

  return {
    ruleId: rule.id,
    client: rule.clientSnapshot,
    task: rule.taskSnapshot,
    processedFrom,
    processedThrough: today,
    created,
    adopted,
    skippedNonWorkingDates: allDates.length - eligibleDates.length,
    alreadyProcessed: false,
    status: "completed",
  }
}

const recurrenceSelect = {
  id: true,
  tenantId: true,
  lmsAllocationId: true,
  taskTypeId: true,
  clientSnapshot: true,
  taskSnapshot: true,
  durationMinutes: true,
  weekdayMask: true,
  startsOn: true,
  processedThrough: true,
  lmsAllocation: { select: { id: true } },
  taskType: { select: { id: true, isActive: true } },
} satisfies Prisma.LmsWorkRecurrenceSelect

async function processRule(
  context: AutomationContext,
  ruleId: string,
  today: string,
  now: Date,
  dryRun: boolean
) {
  if (dryRun) {
    const rule = await prisma.lmsWorkRecurrence.findFirstOrThrow({
      where: { id: ruleId, tenantId: context.tenantId, isActive: true },
      select: recurrenceSelect,
    })
    return reconcileRule(prisma, context, rule, today, now, true)
  }

  const execute = () => prisma.$transaction(async (tx) => {
    const rule = await tx.lmsWorkRecurrence.findFirstOrThrow({
      where: { id: ruleId, tenantId: context.tenantId, isActive: true },
      select: recurrenceSelect,
    })
    return reconcileRule(tx, context, rule, today, now, false)
  }, { maxWait: 5_000, timeout: 20_000 })

  try {
    return await execute()
  } catch (error) {
    if (!isRetryableAutomationConflict(error)) throw error
    return execute()
  }
}

function failedResult(rule: Pick<RecurrenceRecord, "id" | "clientSnapshot" | "taskSnapshot">, error: unknown) {
  const knownError = error instanceof LmsDailyAdminAutomationError ? error : null
  return {
    ruleId: rule.id,
    client: rule.clientSnapshot,
    task: rule.taskSnapshot,
    processedFrom: null,
    processedThrough: null,
    created: 0,
    adopted: 0,
    skippedNonWorkingDates: 0,
    alreadyProcessed: false,
    status: "failed" as const,
    errorCode: knownError?.code ?? "LMS_RECURRENCE_UNEXPECTED_ERROR",
    error: knownError?.message ?? "The recurrence rule could not be processed",
  }
}

export async function runLmsDailyAdminAutomation(options?: { now?: Date; dryRun?: boolean }) {
  const now = options?.now ?? new Date()
  const today = getBucharestDateOnly(now)
  const dryRun = options?.dryRun ?? false
  const context = await resolveAutomationOwner()
  const rules = await prisma.lmsWorkRecurrence.findMany({
    where: { tenantId: context.tenantId, isActive: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: recurrenceSelect,
  })

  const results: LmsRecurringRuleRunResult[] = []
  for (const rule of rules) {
    try {
      results.push(await processRule(context, rule.id, today, now, dryRun))
    } catch (error) {
      results.push(failedResult(rule, error))
    }
  }

  const summary: LmsRecurringWorkRunSummary = {
    date: today,
    rulesProcessed: results.length,
    entriesCreated: results.reduce((sum, result) => sum + result.created, 0),
    entriesAdopted: results.reduce((sum, result) => sum + result.adopted, 0),
    skippedNonWorkingDates: results.reduce((sum, result) => sum + result.skippedNonWorkingDates, 0),
    failedRules: results.filter((result) => result.status === "failed").length,
    alreadyProcessed: results.filter((result) => result.alreadyProcessed).length,
    results,
  }

  return { context, summary }
}
