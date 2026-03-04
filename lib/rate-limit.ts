import prisma from "@/lib/prisma"

const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 10

export async function checkRateLimit(
    key: string,
    options?: { windowMs?: number; maxAttempts?: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

    const now = new Date()
    const nextReset = new Date(now.getTime() + windowMs)

    return prisma.$transaction(async (tx) => {
        const existing = await tx.rateLimitEntry.findUnique({ where: { key } })

        if (!existing || existing.resetAt <= now) {
            await tx.rateLimitEntry.upsert({
                where: { key },
                create: { key, count: 1, resetAt: nextReset },
                update: { count: 1, resetAt: nextReset },
            })
            return { allowed: true, remaining: maxAttempts - 1, resetAt: nextReset }
        }

        if (existing.count >= maxAttempts) {
            return { allowed: false, remaining: 0, resetAt: existing.resetAt }
        }

        const updated = await tx.rateLimitEntry.update({
            where: { key },
            data: { count: { increment: 1 } },
            select: { count: true },
        })

        return {
            allowed: true,
            remaining: Math.max(0, maxAttempts - updated.count),
            resetAt: existing.resetAt,
        }
    })
}

export async function cleanupExpiredRateLimits() {
    const now = new Date()
    await prisma.rateLimitEntry.deleteMany({
        where: { resetAt: { lt: now } },
    })
}
