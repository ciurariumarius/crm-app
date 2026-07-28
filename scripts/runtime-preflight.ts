import "dotenv/config"
import { spawnSync } from "node:child_process"
import { PrismaClient } from "@prisma/client"
import { runSecurityPreflight } from "../lib/security/preflight"

const prisma = new PrismaClient()

async function main() {
    runSecurityPreflight()

    const quickCheck = await prisma.$queryRawUnsafe<Array<{ quick_check: string }>>("PRAGMA quick_check")
    if (quickCheck.some((row) => row.quick_check !== "ok")) {
        throw new Error("SQLite quick_check failed")
    }

    const foreignKeys = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>("PRAGMA foreign_key_check")
    if (foreignKeys.length) {
        throw new Error(`SQLite foreign_key_check found ${foreignKeys.length} issue(s)`)
    }

    const migrationStatus = spawnSync(
        process.platform === "win32" ? "npx.cmd" : "npx",
        ["prisma", "migrate", "status"],
        { cwd: process.cwd(), encoding: "utf8" }
    )
    if (migrationStatus.status !== 0) {
        throw new Error(migrationStatus.stderr || migrationStatus.stdout || "Prisma migration status failed")
    }

    process.stdout.write("Runtime preflight OK: security config, migrations, SQLite integrity.\n")
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
    .finally(async () => prisma.$disconnect())
