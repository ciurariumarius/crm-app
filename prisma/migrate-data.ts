import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

const filename = process.env.DATABASE_URL?.replace("file:", "") || "dev.db"
const adapter = new PrismaBetterSqlite3({ url: filename })
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log("Updating existing task statuses...")

    // Update Pending to Active
    const pendingUpdate = await prisma.task.updateMany({
        where: { status: "Pending" },
        data: { status: "Active" }
    })
    console.log(`Updated ${pendingUpdate.count} tasks from Pending to Active.`)

    // Update In Progress to Active (if any)
    const inProgressUpdate = await prisma.task.updateMany({
        where: { status: "In Progress" },
        data: { status: "Active" }
    })
    console.log(`Updated ${inProgressUpdate.count} tasks from In Progress to Active.`)

    // Update Done to Completed
    const doneUpdate = await prisma.task.updateMany({
        where: { status: "Done" },
        data: { status: "Completed" }
    })
    console.log(`Updated ${doneUpdate.count} tasks from Done to Completed.`)

    console.log("Database update complete.")
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
