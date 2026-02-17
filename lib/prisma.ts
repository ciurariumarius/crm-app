import { PrismaClient } from "@prisma/client"
// Force restart after schema change
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import Database from "better-sqlite3"

const prismaClientSingleton = () => {
    // Use BetterSqlite3 for SQLite
    // DATABASE_URL format: file:./dev.db -> ./dev.db
    const filename = process.env.DATABASE_URL?.replace("file:", "") || "dev.db"
    // const connection = new Database(filename) // Not needed
    const adapter = new PrismaBetterSqlite3({ url: filename })
    return new PrismaClient({ adapter })
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma
