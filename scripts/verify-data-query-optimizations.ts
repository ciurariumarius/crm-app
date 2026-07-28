import "dotenv/config"
import { strict as assert } from "node:assert"
import prisma from "../lib/prisma"
import { getLmsModuleDataPage } from "../lib/lms-tasks/db"
import { getProjectSummaryPage } from "../lib/projects/summary"

async function verifyProjectSummaries() {
    const expectedIds = (
        await prisma.project.findMany({
            select: { id: true },
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            take: 20,
        })
    ).map((row) => row.id)
    const summaries = await getProjectSummaryPage({
        where: {},
        sort: "updated_desc",
        page: 1,
        pageSize: 20,
        paginate: true,
        limit: 20,
    })

    assert.deepEqual(summaries.map((row) => row.id), expectedIds)
    for (const summary of summaries) {
        const [taskCount, completedCount, duration] = await Promise.all([
            prisma.task.count({ where: { projectId: summary.id } }),
            prisma.task.count({ where: { projectId: summary.id, status: "Completed" } }),
            prisma.timeLog.aggregate({
                where: { projectId: summary.id },
                _sum: { durationSeconds: true },
            }),
        ])
        assert.equal(summary._count.tasks, taskCount)
        assert.equal(summary.completedTasks, completedCount)
        assert.equal(summary.secondsLogged, Number(duration._sum.durationSeconds ?? 0))
    }
}

async function verifyLmsPagination() {
    const first = await getLmsModuleDataPage({
        page: 1,
        pageSize: 50,
        includeAllocations: true,
    })
    assert.equal(first.rows.length, Math.min(50, first.total))
    assert.equal(first.total, await prisma.lmsTaskLog.count())
    assert.equal(first.aggregates.totalMinutes, Number((
        await prisma.lmsTaskLog.aggregate({ _sum: { durationMinutes: true } })
    )._sum.durationMinutes ?? 0))

    if (first.totalPages > 1) {
        const second = await getLmsModuleDataPage({
            page: 2,
            pageSize: 50,
            includeAllocations: false,
        })
        assert.equal(second.allocations.length, 0)
        assert.equal(
            first.rows.some((row) => second.rows.some((candidate) => candidate.id === row.id)),
            false
        )
    }
}

async function main() {
    await verifyProjectSummaries()
    await verifyLmsPagination()
    process.stdout.write("DATA_QUERY_OPTIMIZATIONS_OK\n")
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => prisma.$disconnect())
