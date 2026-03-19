import { PrismaClient } from "@prisma/client"
import {
    decryptSensitiveValue,
    encryptSensitiveValue,
    getEncryptionConfigSummary,
    shouldRotateSensitiveValue,
} from "../lib/crypto"

const prisma = new PrismaClient()
const DEFAULT_BATCH_SIZE = 200

type CliOptions = {
    dryRun: boolean
    strict: boolean
    tenantId: string | null
    userId: string | null
    limit: number | null
    batchSize: number
}

type RotationStats = {
    scanned: number
    skipped: number
    wouldRotate: number
    rotated: number
    failed: number
}

function printUsage() {
    process.stdout.write(
        [
            "Usage: npm run security:rotate-2fa-secrets -- [options]",
            "",
            "Options:",
            "  --dry-run              Show what would rotate without writing DB changes.",
            "  --strict               Exit with code 1 if any row fails to rotate.",
            "  --tenant <tenantId>    Limit operation to a specific tenant.",
            "  --user <userId>        Limit operation to a specific user ID.",
            "  --limit <number>       Process at most N records.",
            "  --batch <number>       Batch size (default 200).",
            "  --help                 Show this help message.",
            "",
            "Examples:",
            "  npm run security:rotate-2fa-secrets -- --dry-run",
            "  npm run security:rotate-2fa-secrets -- --tenant 123 --strict",
        ].join("\n") + "\n"
    )
}

function parsePositiveInt(
    raw: string | undefined,
    fallback: number | null
): number | null {
    if (!raw) return fallback
    const value = Number.parseInt(raw, 10)
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid positive integer value: "${raw}"`)
    }
    return value
}

function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = {
        dryRun: false,
        strict: false,
        tenantId: null,
        userId: null,
        limit: null,
        batchSize: DEFAULT_BATCH_SIZE,
    }

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === "--help") {
            printUsage()
            process.exit(0)
        }
        if (arg === "--dry-run") {
            options.dryRun = true
            continue
        }
        if (arg === "--strict") {
            options.strict = true
            continue
        }
        if (arg === "--tenant") {
            const value = argv[i + 1]
            if (!value) throw new Error("--tenant requires a value")
            options.tenantId = value
            i += 1
            continue
        }
        if (arg === "--user") {
            const value = argv[i + 1]
            if (!value) throw new Error("--user requires a value")
            options.userId = value
            i += 1
            continue
        }
        if (arg === "--limit") {
            options.limit = parsePositiveInt(argv[i + 1], null)
            i += 1
            continue
        }
        if (arg === "--batch") {
            const parsed = parsePositiveInt(argv[i + 1], DEFAULT_BATCH_SIZE)
            options.batchSize = parsed ?? DEFAULT_BATCH_SIZE
            i += 1
            continue
        }
        throw new Error(`Unknown argument: ${arg}`)
    }

    return options
}

async function rotateTwoFactorSecrets(options: CliOptions): Promise<RotationStats> {
    const stats: RotationStats = {
        scanned: 0,
        skipped: 0,
        wouldRotate: 0,
        rotated: 0,
        failed: 0,
    }

    let cursor: string | undefined

    while (true) {
        const where = {
            twoFactorSecret: { not: null as string | null },
            ...(options.tenantId ? { tenantId: options.tenantId } : {}),
            ...(options.userId ? { id: options.userId } : {}),
        }

        const users = await prisma.user.findMany({
            where,
            select: { id: true, twoFactorSecret: true, tenantId: true },
            orderBy: { id: "asc" },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: options.batchSize,
        })

        if (users.length === 0) break

        for (const user of users) {
            if (options.limit !== null && stats.scanned >= options.limit) {
                return stats
            }

            stats.scanned += 1
            const currentSecret = user.twoFactorSecret

            if (!currentSecret || !shouldRotateSensitiveValue(currentSecret)) {
                stats.skipped += 1
                continue
            }

            try {
                const plaintext = decryptSensitiveValue(currentSecret)
                const reencrypted = encryptSensitiveValue(plaintext)

                if (options.dryRun) {
                    stats.wouldRotate += 1
                    continue
                }

                const result = await prisma.user.updateMany({
                    where: { id: user.id, tenantId: user.tenantId },
                    data: { twoFactorSecret: reencrypted },
                })

                if (result.count === 1) {
                    stats.rotated += 1
                } else {
                    stats.failed += 1
                    process.stderr.write(
                        `Rotation failed: user row not updated (userId=${user.id}, tenantId=${user.tenantId})\n`
                    )
                }
            } catch (error) {
                stats.failed += 1
                const message = error instanceof Error ? error.message : "Unknown error"
                process.stderr.write(
                    `Rotation failed for userId=${user.id}, tenantId=${user.tenantId}: ${message}\n`
                )
            }
        }

        cursor = users[users.length - 1]?.id
    }

    return stats
}

async function main() {
    const options = parseArgs(process.argv.slice(2))
    const encryptionSummary = getEncryptionConfigSummary()

    process.stdout.write(
        `${JSON.stringify(
            {
                action: "rotate_two_factor_secrets",
                options,
                encryption: encryptionSummary,
            },
            null,
            2
        )}\n`
    )

    const startedAt = Date.now()
    const stats = await rotateTwoFactorSecrets(options)
    const durationMs = Date.now() - startedAt

    process.stdout.write(
        `${JSON.stringify(
            {
                success: options.strict ? stats.failed === 0 : true,
                dryRun: options.dryRun,
                durationMs,
                ...stats,
            },
            null,
            2
        )}\n`
    )

    if (options.strict && stats.failed > 0) {
        process.exitCode = 1
    }
}

main()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error"
        process.stderr.write(`Rotation script failed: ${message}\n`)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
