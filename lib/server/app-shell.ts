import { cache } from "react"
import prisma from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export const getCachedSession = cache(getSession)

const timerInclude = {
    task: true,
    project: {
        include: {
            site: true,
            services: {
                select: {
                    serviceName: true,
                    isRecurring: true,
                },
            },
        },
    },
} as const

export const getAppShellData = cache(async (userId: string) => {
    const [activeTimer, preferences] = await Promise.all([
        prisma.timeLog.findFirst({
            where: { endTime: null },
            include: timerInclude,
        }),
        prisma.user.findFirst({
            where: { id: userId },
            select: {
                timerIdlePauseMinutes: true,
                timerHardCapHours: true,
                timerReminderIntervalMinutes: true,
            },
        }),
    ])

    if (activeTimer) {
        return { timer: activeTimer, timerStatus: "running" as const, preferences }
    }

    const pausedTimer = await prisma.timeLog.findFirst({
        where: { isPaused: true },
        orderBy: { endTime: "desc" },
        include: timerInclude,
    })

    return {
        timer: pausedTimer,
        timerStatus: pausedTimer ? "paused" as const : "idle" as const,
        preferences,
    }
})
