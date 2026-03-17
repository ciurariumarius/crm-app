/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client")
const { decryptSensitiveValue, encryptSensitiveValue, shouldRotateSensitiveValue } = require("../lib/crypto")

const prisma = new PrismaClient()
const BATCH_SIZE = 200

async function rotateTwoFactorSecrets() {
    let rotated = 0
    let skipped = 0
    let failed = 0
    let cursor: string | undefined

    while (true) {
        const users = await prisma.user.findMany({
            where: { twoFactorSecret: { not: null } },
            select: { id: true, twoFactorSecret: true, tenantId: true },
            orderBy: { id: "asc" },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: BATCH_SIZE,
        })

        if (users.length === 0) {
            break
        }

        for (const user of users) {
            const current = user.twoFactorSecret
            if (!current) {
                skipped += 1
                continue
            }

            try {
                if (!shouldRotateSensitiveValue(current)) {
                    skipped += 1
                    continue
                }

                const plaintext = decryptSensitiveValue(current)
                const reencrypted = encryptSensitiveValue(plaintext)

                await prisma.user.update({
                    where: { id: user.id },
                    data: { twoFactorSecret: reencrypted },
                })
                rotated += 1
            } catch (error) {
                failed += 1
                console.error("Failed to rotate 2FA secret", {
                    userId: user.id,
                    tenantId: user.tenantId,
                    error: error instanceof Error ? error.message : "Unknown error",
                })
            }
        }

        cursor = users[users.length - 1]?.id
    }

    console.log("2FA secret rotation finished", { rotated, skipped, failed })
}

rotateTwoFactorSecrets()
    .catch((error) => {
        console.error("Rotation script failed", error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

export {}
