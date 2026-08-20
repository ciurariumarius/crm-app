import assert from "node:assert/strict"
import { buildProjectWhereInput, normalizeProjectFilters } from "../lib/filters/project-filters"
import { resolveUtcDateRange } from "../lib/filters/date-range"
import { buildTaskWhereInput, getLocalDayBounds, normalizeTaskFilters } from "../lib/filters/task-filters"

function run() {
    const march19Utc = new Date("2026-03-19T12:00:00.000Z")

    const lastMonth = resolveUtcDateRange({
        period: "last_month",
        now: march19Utc,
    })
    assert.equal(lastMonth.gte?.toISOString(), "2026-02-01T00:00:00.000Z")
    assert.equal(lastMonth.lt?.toISOString(), "2026-03-01T00:00:00.000Z")

    const customReversed = resolveUtcDateRange({
        period: "all_time",
        from: "2026-03-21",
        to: "2026-03-19",
        now: march19Utc,
    })
    assert.equal(customReversed.gte?.toISOString(), "2026-03-19T00:00:00.000Z")
    assert.equal(customReversed.lt?.toISOString(), "2026-03-22T00:00:00.000Z")

    const normalizedProjectFilters = normalizeProjectFilters({
        status: "Completed",
        recurring: "Recurring",
        payment: "Unpaid",
        partnerId: "partner-1",
        period: "last_month",
        q: "optik",
    })
    const projectWhere = buildProjectWhereInput({
        filters: normalizedProjectFilters,
        now: march19Utc,
    })

    const projectWhereJson = JSON.stringify(projectWhere)
    assert.doesNotMatch(projectWhereJson, /tenantId/)
    assert.match(projectWhereJson, /"status":"Completed"/)
    assert.match(projectWhereJson, /"paymentStatus":"Unpaid"/)
    assert.match(projectWhereJson, /"partnerId":"partner-1"/)
    assert.match(projectWhereJson, /"isRecurring":true/)
    assert.match(projectWhereJson, /"createdAt":\{"gte":"2026-02-01T00:00:00\.000Z","lt":"2026-03-01T00:00:00\.000Z"\}/)

    const normalizedTaskFilters = normalizeTaskFilters({
        status: "Pending",
        urgency: "High",
        overdue: "1",
        dueToday: "1",
        partnerId: "partner-2",
        q: "facebook",
        scope: "lms",
    })
    assert.equal(normalizedTaskFilters.status, "Pending")
    assert.equal(normalizedTaskFilters.urgency, "High")
    assert.equal(normalizedTaskFilters.dueTodayOnly, true)
    assert.equal(normalizedTaskFilters.overdueOnly, false)
    assert.equal(normalizedTaskFilters.scope, "LMS")

    const { todayStart, todayEnd } = getLocalDayBounds(new Date("2026-03-19T08:00:00.000Z"))
    const taskWhere = buildTaskWhereInput({
        filters: normalizedTaskFilters,
        todayStart,
        todayEnd,
    })

    const taskWhereJson = JSON.stringify(taskWhere)
    assert.doesNotMatch(taskWhereJson, /tenantId/)
    assert.match(taskWhereJson, /"status":\{"in":\["Pending","Paused"\]\}/)
    assert.match(taskWhereJson, /"urgency":\{"in":\["High","Urgent","urgent","high"\]\}/)
    assert.match(taskWhereJson, /"partnerId":"partner-2"/)
    assert.match(taskWhereJson, /"taskScope":"LMS"/)
    assert.match(taskWhereJson, /"lmsAllocation":\{"client":\{"contains":"facebook"\}\}/)
    assert.match(taskWhereJson, /"lmsTaskType":\{"name":\{"contains":"facebook"\}\}/)
    assert.ok(
        taskWhereJson.includes(
            `"deadline":{"not":null,"gte":"${todayStart.toISOString()}","lte":"${todayEnd.toISOString()}"}`
        )
    )

    process.stdout.write("verify-filter-helpers: ok\n")
}

run()
